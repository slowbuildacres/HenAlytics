// ============================================================================
// Siri + Shortcuts: "Hey Siri, log eggs in Henalytics" (iOS 17+)
// ----------------------------------------------------------------------------
//   • LogEggsIntent   — "How many?" → "Which flock?" (only when there's more
//                       than one) → adds the eggs to that flock's tally.
//   • EggsTodayIntent — reads back today's count, per flock.
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
    let day: String
    let flocks: [Flock]?

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
    }
}
