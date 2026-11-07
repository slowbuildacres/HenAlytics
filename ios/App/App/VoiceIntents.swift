// ============================================================================
// Siri + Shortcuts: "Hey Siri, log eggs in Henalytics" (iOS 17+)
// ----------------------------------------------------------------------------
//   • LogEggsIntent   — "How many?" → "Which flock?" (only when there's more
//                       than one) → adds the eggs to that flock's tally.
//   • EggsTodayIntent — reads back today's count, per flock.
//   • LogFeedingIntent, LogMilkIntent, LogHarvestIntent (3.0) — "log a
//     feeding", "log milk", "log a harvest". These queue a small record in
//     the App Group (key "voiceLogs") that the web app turns into the same
//     entry its forms save (src/widgetBridge.js → applyVoiceLogs).
//
// Voice logs go through the same App Group store as the Egg Counter widget
// (group.com.henalytics.app, key "eggTally": { flockId: { "yyyy-MM-dd": n } }).
// The web app folds that tally into the flock's egg basket on launch/resume,
// or right away when the app is already open (WidgetBridgePlugin listens for
// .henTallyChanged and tells the web layer). Same save path as a widget tap,
// so nothing new on the JS side beyond that listener.
//
// Flock names come from the snapshot the app writes to key "today"
// (src/widgetBridge.js → WidgetBridge.setToday). App Shortcuts have to live in
// the app target, so this file keeps its own small copy of the store/snapshot
// readers rather than sharing the widget extension's.
// ============================================================================

import AppIntents
import Foundation
import WidgetKit

extension Notification.Name {
    /// Posted after a voice log adds eggs, so an open app can pick them up now.
    static let henTallyChanged = Notification.Name("HenalyticsTallyChanged")
}

// MARK: - Shared App Group data

private let voiceAppGroup = "group.com.henalytics.app"

private struct VoiceSnapshot: Decodable {
    struct Flock: Decodable {
        let id: String
        let name: String
        let basket: Int?
        let logged: Int?
    }
    struct Animal: Decodable {
        let id: String
        let name: String
        let type: String
        let milk: Bool?
    }
    let day: String
    let flocks: [Flock]?
    let animals: [Animal]?
    let garden: Bool?

    static func load() -> VoiceSnapshot? {
        guard let defaults = UserDefaults(suiteName: voiceAppGroup),
              let json = defaults.string(forKey: "today"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(VoiceSnapshot.self, from: data)
    }
}

private func voiceLocalDay(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

private enum VoiceTally {
    static let key = "eggTally"

    static func load() -> [String: [String: Int]] {
        guard let defaults = UserDefaults(suiteName: voiceAppGroup),
              let json = defaults.string(forKey: key),
              let data = json.data(using: .utf8),
              let value = try? JSONDecoder().decode([String: [String: Int]].self, from: data) else { return [:] }
        return value
    }

    static func pending(flockId: String, day: String) -> Int {
        load()[flockId]?[day] ?? 0
    }

    /// Same shape and rules as EggTallyStore in HenalyticsWidget.swift.
    static func add(flockId: String, day: String, count: Int) {
        guard count > 0, let defaults = UserDefaults(suiteName: voiceAppGroup) else { return }
        var all = load()
        var days = all[flockId] ?? [:]
        days[day] = (days[day] ?? 0) + count
        all[flockId] = days
        if let data = try? JSONEncoder().encode(all), let json = String(data: data, encoding: .utf8) {
            defaults.set(json, forKey: key)
        }
    }
}

/// Feedings, milk and harvests from Siri wait here until the app takes them
/// (WidgetBridge.takeVoiceLogs): [{ id, kind, date, hobbyId?, lbs?, crop?, oz? }].
private enum VoiceLogQueue {
    static let key = "voiceLogs"

    static func append(_ item: [String: Any]) {
        guard let defaults = UserDefaults(suiteName: voiceAppGroup) else { return }
        var list: [[String: Any]] = []
        if let json = defaults.string(forKey: key), let data = json.data(using: .utf8),
           let existing = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            list = existing
        }
        var rec = item
        rec["id"] = UUID().uuidString
        rec["date"] = voiceLocalDay()
        list.append(rec)
        if list.count > 200 { list.removeFirst(list.count - 200) }
        if let data = try? JSONSerialization.data(withJSONObject: list), let json = String(data: data, encoding: .utf8) {
            defaults.set(json, forKey: key)
        }
    }
}

/// Eggs counted today for one flock: in the basket + already saved + waiting in the tally.
private func eggsToday(_ flock: VoiceSnapshot.Flock, snapshot: VoiceSnapshot?, day: String) -> Int {
    let fresh = snapshot?.day == day
    let basket = fresh ? (flock.basket ?? 0) : 0
    let logged = fresh ? (flock.logged ?? 0) : 0
    return max(0, basket + logged + VoiceTally.pending(flockId: flock.id, day: day))
}

private func eggWord(_ n: Int) -> String { n == 1 ? "egg" : "eggs" }

// MARK: - Flock entity (what Siri picks from)

@available(iOS 17.0, *)
struct VoiceFlockEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Flock" }
    static var defaultQuery = VoiceFlockQuery()

    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    static func all() -> [VoiceFlockEntity] {
        (VoiceSnapshot.load()?.flocks ?? []).map { VoiceFlockEntity(id: $0.id, name: $0.name) }
    }
}

@available(iOS 17.0, *)
struct VoiceFlockQuery: EntityStringQuery {
    func entities(for identifiers: [VoiceFlockEntity.ID]) async throws -> [VoiceFlockEntity] {
        VoiceFlockEntity.all().filter { identifiers.contains($0.id) }
    }

    /// Lets Siri match a spoken name ("the girls", "ducks").
    func entities(matching string: String) async throws -> [VoiceFlockEntity] {
        let needle = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return VoiceFlockEntity.all() }
        return VoiceFlockEntity.all().filter {
            let name = $0.name.lowercased()
            return name.contains(needle) || needle.contains(name)
        }
    }

    func suggestedEntities() async throws -> [VoiceFlockEntity] {
        VoiceFlockEntity.all()
    }
}

// MARK: - Animals entity (feeding and milk)

@available(iOS 17.0, *)
struct VoiceAnimalsEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Animals" }
    static var defaultQuery = VoiceAnimalsQuery()

    var id: String
    var name: String
    var milk: Bool

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    static func all(milkOnly: Bool = false) -> [VoiceAnimalsEntity] {
        (VoiceSnapshot.load()?.animals ?? [])
            .map { VoiceAnimalsEntity(id: $0.id, name: $0.name, milk: $0.milk ?? false) }
            .filter { !milkOnly || $0.milk }
    }
}

@available(iOS 17.0, *)
struct VoiceAnimalsQuery: EntityStringQuery {
    func entities(for identifiers: [VoiceAnimalsEntity.ID]) async throws -> [VoiceAnimalsEntity] {
        VoiceAnimalsEntity.all().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [VoiceAnimalsEntity] {
        let needle = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return VoiceAnimalsEntity.all() }
        return VoiceAnimalsEntity.all().filter {
            let name = $0.name.lowercased()
            // "the goats" / "goat" both find "Goats".
            let stem = name.hasSuffix("s") ? String(name.dropLast()) : name
            return name.contains(needle) || needle.contains(stem)
        }
    }

    func suggestedEntities() async throws -> [VoiceAnimalsEntity] {
        VoiceAnimalsEntity.all()
    }
}

@available(iOS 17.0, *)
enum VoiceMilkUnit: String, AppEnum {
    case gallons, quarts, pints, cups, ounces

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Unit" }
    static var caseDisplayRepresentations: [VoiceMilkUnit: DisplayRepresentation] {
        [.gallons: "gallons", .quarts: "quarts", .pints: "pints", .cups: "cups", .ounces: "ounces"]
    }

    var ounces: Double {
        switch self {
        case .gallons: return 128
        case .quarts: return 32
        case .pints: return 16
        case .cups: return 8
        case .ounces: return 1
        }
    }
}

private func amountText(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
}

@available(iOS 17.0, *)
private func notifyApp() async {
    await MainActor.run {
        NotificationCenter.default.post(name: .henTallyChanged, object: nil)
    }
}

// MARK: - Intents

@available(iOS 17.0, *)
struct LogEggsIntent: AppIntent {
    static var title: LocalizedStringResource { "Log eggs" }
    static var description: IntentDescription { "Add the eggs you just collected to today's count." }

    @Parameter(title: "Eggs", requestValueDialog: "How many eggs?")
    var count: Int

    @Parameter(title: "Flock")
    var flock: VoiceFlockEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$count) eggs for \(\.$flock)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let all = VoiceFlockEntity.all()
        guard !all.isEmpty else {
            return .result(dialog: "Open Henalytics once so I can see your flocks, then try again.")
        }
        guard count > 0 else {
            throw $count.needsValueError("How many eggs?")
        }
        guard count <= 500 else {
            return .result(dialog: "That's more than I can log at once. Open Henalytics to add that many.")
        }

        var chosen = flock
        if chosen == nil {
            if all.count == 1 {
                chosen = all[0]
            } else {
                chosen = try await $flock.requestDisambiguation(among: all, dialog: "Which flock?")
            }
        }
        guard let target = chosen, all.contains(where: { $0.id == target.id }) else {
            return .result(dialog: "I couldn't find that flock in Henalytics.")
        }

        let day = voiceLocalDay()
        VoiceTally.add(flockId: target.id, day: day, count: count)
        WidgetCenter.shared.reloadAllTimelines()
        await MainActor.run {
            NotificationCenter.default.post(name: .henTallyChanged, object: nil)
        }

        let snap = VoiceSnapshot.load()
        let total = snap?.flocks?.first(where: { $0.id == target.id }).map { eggsToday($0, snapshot: snap, day: day) } ?? count
        if all.count == 1 {
            return .result(dialog: "Logged \(count) \(eggWord(count)). That's \(total) today.")
        }
        return .result(dialog: "Logged \(count) \(eggWord(count)) for \(target.name). That's \(total) today.")
    }
}

@available(iOS 17.0, *)
struct EggsTodayIntent: AppIntent {
    static var title: LocalizedStringResource { "Eggs today" }
    static var description: IntentDescription { "Hear how many eggs you've collected today." }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let snap = VoiceSnapshot.load()
        let flocks = snap?.flocks ?? []
        guard !flocks.isEmpty else {
            return .result(dialog: "Open Henalytics once so I can see your flocks.")
        }
        let day = voiceLocalDay()
        let counts = flocks.map { ($0.name, eggsToday($0, snapshot: snap, day: day)) }
        let total = counts.reduce(0) { $0 + $1.1 }
        if total == 0 {
            return .result(dialog: "No eggs logged yet today.")
        }
        if flocks.count == 1 {
            return .result(dialog: "\(total) \(eggWord(total)) today.")
        }
        let parts = counts.filter { $0.1 > 0 }.map { "\($0.1) from \($0.0)" }
        return .result(dialog: "\(total) \(eggWord(total)) today: \(ListFormatter.localizedString(byJoining: parts)).")
    }
}

@available(iOS 17.0, *)
struct LogFeedingIntent: AppIntent {
    static var title: LocalizedStringResource { "Log a feeding" }
    static var description: IntentDescription { "Log that you fed your animals." }

    @Parameter(title: "Animals")
    var animals: VoiceAnimalsEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Log a feeding for \(\.$animals)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let all = VoiceAnimalsEntity.all()
        guard !all.isEmpty else {
            return .result(dialog: "Open Henalytics once so I can see your animals, then try again.")
        }
        var chosen = animals
        if chosen == nil {
            if all.count == 1 {
                chosen = all[0]
            } else {
                chosen = try await $animals.requestDisambiguation(among: all, dialog: "Which animals?")
            }
        }
        guard let target = chosen, all.contains(where: { $0.id == target.id }) else {
            return .result(dialog: "I couldn't find those animals in Henalytics.")
        }
        VoiceLogQueue.append(["kind": "feed", "hobbyId": target.id])
        await notifyApp()
        return .result(dialog: "Logged a feeding for \(target.name).")
    }
}

@available(iOS 17.0, *)
struct LogMilkIntent: AppIntent {
    static var title: LocalizedStringResource { "Log milk" }
    static var description: IntentDescription { "Log how much milk you got." }

    @Parameter(title: "Amount", requestValueDialog: "How much milk?")
    var amount: Double

    @Parameter(title: "Unit", requestValueDialog: "Gallons, quarts, cups or ounces?")
    var unit: VoiceMilkUnit

    @Parameter(title: "Animals")
    var animals: VoiceAnimalsEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$amount) \(\.$unit) of milk from \(\.$animals)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let dairy = VoiceAnimalsEntity.all(milkOnly: true)
        guard !dairy.isEmpty else {
            return .result(dialog: "Turn on goats, cows or dairy sheep in Henalytics first.")
        }
        guard amount > 0 else { throw $amount.needsValueError("How much milk?") }
        let oz = amount * unit.ounces
        guard oz <= 4000 else {
            return .result(dialog: "That's more than I can log at once. Open Henalytics to add it.")
        }
        var chosen = animals
        if chosen == nil {
            if dairy.count == 1 {
                chosen = dairy[0]
            } else {
                chosen = try await $animals.requestDisambiguation(among: dairy, dialog: "From which animals?")
            }
        }
        guard let target = chosen, dairy.contains(where: { $0.id == target.id }) else {
            return .result(dialog: "I couldn't find those animals in Henalytics.")
        }
        VoiceLogQueue.append(["kind": "milk", "hobbyId": target.id, "oz": oz])
        await notifyApp()
        return .result(dialog: "Logged \(amountText(amount)) \(unit.rawValue) of milk from \(target.name).")
    }
}

@available(iOS 17.0, *)
struct LogHarvestIntent: AppIntent {
    static var title: LocalizedStringResource { "Log a harvest" }
    static var description: IntentDescription { "Log what you picked from the garden." }

    @Parameter(title: "Crop", requestValueDialog: "What did you pick?")
    var crop: String

    @Parameter(title: "Pounds", requestValueDialog: "How many pounds?")
    var pounds: Double

    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$pounds) pounds of \(\.$crop)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard VoiceSnapshot.load()?.garden == true else {
            return .result(dialog: "Turn on the garden in Henalytics first.")
        }
        let name = crop.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw $crop.needsValueError("What did you pick?") }
        guard pounds > 0 else { throw $pounds.needsValueError("How many pounds?") }
        guard pounds <= 2000 else {
            return .result(dialog: "That's more than I can log at once. Open Henalytics to add it.")
        }
        VoiceLogQueue.append(["kind": "harvest", "crop": String(name.prefix(60)), "lbs": pounds])
        await notifyApp()
        let word = pounds == 1 ? "pound" : "pounds"
        return .result(dialog: "Logged \(amountText(pounds)) \(word) of \(name).")
    }
}

// MARK: - Phrases Siri listens for

@available(iOS 17.0, *)
struct HenalyticsShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogEggsIntent(),
            phrases: [
                "Log eggs in \(.applicationName)",
                "Add eggs in \(.applicationName)",
                "Count eggs in \(.applicationName)",
                "Log eggs for \(\.$flock) in \(.applicationName)",
            ],
            shortTitle: "Log eggs",
            systemImageName: "basket"
        )
        AppShortcut(
            intent: EggsTodayIntent(),
            phrases: [
                "How many eggs today in \(.applicationName)",
                "How many eggs in \(.applicationName)",
                "Eggs today in \(.applicationName)",
            ],
            shortTitle: "Eggs today",
            systemImageName: "number"
        )
        AppShortcut(
            intent: LogFeedingIntent(),
            phrases: [
                "Log a feeding in \(.applicationName)",
                "Log feeding in \(.applicationName)",
                "I fed the \(\.$animals) in \(.applicationName)",
                "Log a feeding for the \(\.$animals) in \(.applicationName)",
            ],
            shortTitle: "Log a feeding",
            systemImageName: "fork.knife"
        )
        AppShortcut(
            intent: LogMilkIntent(),
            phrases: [
                "Log milk in \(.applicationName)",
                "Log milking in \(.applicationName)",
                "Log milk from the \(\.$animals) in \(.applicationName)",
            ],
            shortTitle: "Log milk",
            systemImageName: "drop"
        )
        AppShortcut(
            intent: LogHarvestIntent(),
            phrases: [
                "Log a harvest in \(.applicationName)",
                "Log harvest in \(.applicationName)",
                "Log what I picked in \(.applicationName)",
            ],
            shortTitle: "Log a harvest",
            systemImageName: "leaf"
        )
    }
}
