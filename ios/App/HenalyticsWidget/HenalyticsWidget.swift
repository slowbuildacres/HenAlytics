// ============================================================================
// Henalytics home-screen + lock-screen widgets (iOS 17+)
// ----------------------------------------------------------------------------
// Three widgets:
//   • "Today"       — medium/large: tonight's frost warning, eggs logged
//                     today and what's coming up on the calendar, with log
//                     buttons. Reads a snapshot the app writes to the App
//                     Group (group.com.henalytics.app, key "today") through
//                     App/WidgetBridge.swift — see src/widgetBridge.js.
//   • "Quick Log"   — medium home-screen widget: Eggs, Harvest, Water, Note.
//   • "One-Tap Log" — small home-screen OR lock-screen widget. Long-press →
//                     Edit Widget to choose what it logs.
//   • "Egg Counter" — small/medium, interactive: tap + as you collect for
//                     the flock you picked (Edit Widget). Taps go to the
//                     App Group key "eggTally"; the app folds them into that
//                     flock's egg basket on open, which saves to the day.
// Every tap opens the app straight into the matching log form via a
// henalytics:// link that HomesteadApp.jsx handles (see WIDGET DEEP LINKS).
// ============================================================================

import WidgetKit
import UIKit
import SwiftUI
import AppIntents

// MARK: - Brand colors (3.0 Farmhouse palette, src/newlook/theme.js)
// Each color has a light and a dark value; widgets follow the phone's
// light/dark setting.

private extension Color {
    static func hen(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let v = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
        })
    }
    static let henBg = hen(0xF6F1E7, 0x1A130F)       // paper
    static let henCard = hen(0xFFFDF8, 0x241B16)     // card
    static let henLine = hen(0xE3D8C6, 0x3A2D24)     // card border
    static let henInk = hen(0x2A1A12, 0xF3EADB)      // text
    static let henInkSoft = hen(0x6B5646, 0xBCAA94)  // secondary text
    static let henYolk = hen(0xE3A92B, 0xE8B04A)     // the one primary color
    static let henOnYolk = hen(0x2A1A12, 0x1A130F)   // text on yolk
    static let henAccent = hen(0xB4472E, 0xE0795E)   // frost, warnings
    static let henFrostBg = hen(0xFBEDE8, 0x3A1F18)
    static let henChip = hen(0xF3ECDF, 0x33271F)     // icon wells
}

// MARK: - Actions

enum LogAction: String, AppEnum, CaseIterable {
    // Raw values are stored in placed One-Tap widgets' settings, so existing
    // cases must keep their names. New cases go at the end.
    case eggs, fed, water, note, harvest

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Log action" }
    static var caseDisplayRepresentations: [LogAction: DisplayRepresentation] {
        [
            .eggs: "Collect eggs",
            .fed: "Fed the chickens",
            .water: "Watered the garden",
            .note: "Quick note",
            .harvest: "Log a harvest",
        ]
    }

    var emoji: String {
        switch self {
        case .eggs: return "🥚"
        case .fed: return "🌾"
        case .water: return "💧"
        case .note: return "📝"
        case .harvest: return "🧺"
        }
    }

    /// Line icon (SF Symbol) used on the widgets since 3.0.
    var symbol: String {
        switch self {
        case .eggs: return "oval.portrait"
        case .fed: return "leaf"
        case .water: return "drop"
        case .note: return "square.and.pencil"
        case .harvest: return "basket"
        }
    }

    var shortLabel: String {
        switch self {
        case .eggs: return "Eggs"
        case .fed: return "Fed"
        case .water: return "Water"
        case .note: return "Note"
        case .harvest: return "Harvest"
        }
    }

    var url: URL {
        switch self {
        case .eggs: return URL(string: "henalytics://log?hobby=egg_layers&action=eggs")!
        case .fed: return URL(string: "henalytics://log?hobby=egg_layers&action=fed")!
        case .water: return URL(string: "henalytics://log?hobby=garden&action=watered")!
        // hobby=any → whichever hobby you were last on
        case .note: return URL(string: "henalytics://log?hobby=any&action=note")!
        case .harvest: return URL(string: "henalytics://log?hobby=garden&action=harvested")!
        }
    }

    /// The four Quick Log buttons.
    static let quickLog: [LogAction] = [.eggs, .harvest, .water, .note]
}

// MARK: - Quick Log (medium, four buttons)

struct QuickLogEntry: TimelineEntry {
    let date: Date
}

struct QuickLogProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickLogEntry { QuickLogEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (QuickLogEntry) -> Void) {
        completion(QuickLogEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickLogEntry>) -> Void) {
        // Static buttons — nothing to refresh.
        completion(Timeline(entries: [QuickLogEntry(date: .now)], policy: .never))
    }
}

struct QuickLogView: View {
    var entry: QuickLogEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Log it now")
                .font(.system(size: 15, weight: .regular, design: .serif))
                .foregroundStyle(Color.henInkSoft)
            HStack(spacing: 8) {
                ForEach(LogAction.quickLog, id: \.self) { action in
                    Link(destination: action.url) {
                        VStack(spacing: 5) {
                            Image(systemName: action.symbol)
                                .font(.system(size: 21, weight: .regular))
                                .foregroundStyle(action == .eggs ? Color.henOnYolk : Color.henInk)
                            Text(action.shortLabel)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(action == .eggs ? Color.henOnYolk : Color.henInk)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(action == .eggs ? Color.henYolk : Color.henCard)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(action == .eggs ? Color.clear : Color.henLine, lineWidth: 1)
                        )
                    }
                }
            }
        }
        .containerBackground(for: .widget) { Color.henBg }
    }
}

struct QuickLogWidget: Widget {
    let kind = "HenalyticsQuickLog"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickLogProvider()) { entry in
            QuickLogView(entry: entry)
        }
        .configurationDisplayName("Quick Log")
        .description("One tap to log eggs, a harvest, watering or a note.")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Today (medium + large, reads the app's snapshot)

let henAppGroup = "group.com.henalytics.app"

/// One egg-layer flock from the app's snapshot (src/widgetBridge.js).
/// basket = eggs in today's in-app basket; logged = eggs already saved today.
struct TodayFlock: Decodable {
    let id: String
    let name: String
    let emoji: String?
    let basket: Int?
    let logged: Int?
}

struct TodaySnapshot: Decodable {
    struct Frost: Decodable { let lowText: String; let crops: [String]? }
    struct Task: Decodable { let date: String; let title: String }
    let day: String
    let name: String?
    let eggsToday: Int?
    let frost: Frost?
    let tasks: [Task]?
    let flocks: [TodayFlock]?

    static func load() -> TodaySnapshot? {
        guard let defaults = UserDefaults(suiteName: henAppGroup),
              let json = defaults.string(forKey: "today"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
    }
}

func henLocalDay(_ date: Date) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot?
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry { TodayEntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: .now, snapshot: TodaySnapshot.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        // One entry now and one just after midnight so "today" rolls over
        // (stale eggs/frost drop, past tasks fall off). The app also reloads
        // the timeline whenever its data changes.
        let snap = TodaySnapshot.load()
        let cal = Calendar.current
        let midnight = cal.date(byAdding: .minute, value: 1, to: cal.startOfDay(for: cal.date(byAdding: .day, value: 1, to: .now)!))!
        completion(Timeline(entries: [TodayEntry(date: .now, snapshot: snap), TodayEntry(date: midnight, snapshot: snap)],
                            policy: .after(cal.date(byAdding: .hour, value: 3, to: midnight)!)))
    }
}

struct TodayView: View {
    @Environment(\.widgetFamily) private var family
    var entry: TodayEntry

    private var today: String { henLocalDay(entry.date) }
    private var fresh: Bool { entry.snapshot?.day == today }

    private func dayLabel(_ iso: String) -> String {
        if iso == today { return "Today" }
        if let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: entry.date), iso == henLocalDay(tomorrow) { return "Tomorrow" }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: iso) else { return iso }
        let out = DateFormatter(); out.setLocalizedDateFormatFromTemplate("EEE")
        return out.string(from: d)
    }

    private var tasks: [TodaySnapshot.Task] {
        (entry.snapshot?.tasks ?? []).filter { $0.date >= today }
    }

    private var frostLine: String? {
        guard fresh, let f = entry.snapshot?.frost else { return nil }
        let crops = (f.crops ?? []).map { $0.lowercased() }
        if crops.isEmpty { return "Frost tonight, low \(f.lowText)" }
        return "Frost tonight, low \(f.lowText): cover \(ListFormatter.localizedString(byJoining: crops))"
    }

    private var eggsLine: String? {
        guard let snap = entry.snapshot, snap.eggsToday != nil else { return nil }
        let n = fresh ? (snap.eggsToday ?? 0) : 0
        return n > 0 ? "\(n) egg\(n == 1 ? "" : "s") today" : "No eggs logged yet today"
    }

    var body: some View {
        let maxTasks = family == .systemLarge ? 6 : (frostLine == nil ? 2 : 1)
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.snapshot?.name?.isEmpty == false ? entry.snapshot!.name! : "Today")
                    .font(.system(size: 17, weight: .regular, design: .serif))
                    .foregroundStyle(Color.henInk)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(entry.date, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                    .font(.system(size: 11))
                    .foregroundStyle(Color.henInkSoft)
            }
            if let frost = frostLine {
                Label(frost, systemImage: "snowflake")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.henAccent)
                    .lineLimit(2)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.henFrostBg))
            }
            if let eggs = eggsLine {
                Label(eggs, systemImage: "oval.portrait").font(.system(size: 12)).foregroundStyle(Color.henInk).lineLimit(1)
            }
            if entry.snapshot == nil {
                Text("Open Henalytics once to fill this in.")
                    .font(.system(size: 12)).foregroundStyle(Color.henInkSoft)
            } else if tasks.isEmpty {
                Label("Nothing on the calendar this week", systemImage: "calendar")
                    .font(.system(size: 12)).foregroundStyle(Color.henInkSoft).lineLimit(1)
            } else {
                ForEach(Array(tasks.prefix(maxTasks).enumerated()), id: \.offset) { _, t in
                    Label("\(dayLabel(t.date)) · \(t.title)", systemImage: "calendar")
                        .font(.system(size: 12)).foregroundStyle(Color.henInk).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                ForEach([LogAction.eggs, .harvest, .note], id: \.self) { action in
                    Link(destination: action.url) {
                        Label(action.shortLabel, systemImage: action.symbol)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(action == .eggs ? Color.henOnYolk : Color.henInk)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(action == .eggs ? Color.henYolk : Color.henCard))
                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(action == .eggs ? Color.clear : Color.henLine, lineWidth: 1))
                    }
                }
            }
        }
        .widgetURL(URL(string: "henalytics://open"))
        .containerBackground(for: .widget) { Color.henBg }
    }
}

struct TodayWidget: Widget {
    let kind = "HenalyticsToday"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayProvider()) { entry in
            TodayView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Frost warnings, eggs today and what's coming up, with quick log buttons.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// MARK: - One-Tap Log (small + lock screen, configurable)

struct PickActionIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Choose what to log" }
    static var description: IntentDescription { "Tapping the widget opens straight to this log." }

    @Parameter(title: "Log", default: .eggs)
    var action: LogAction
}

struct OneTapEntry: TimelineEntry {
    let date: Date
    let action: LogAction
}

struct OneTapProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> OneTapEntry { OneTapEntry(date: .now, action: .eggs) }
    func snapshot(for configuration: PickActionIntent, in context: Context) async -> OneTapEntry {
        OneTapEntry(date: .now, action: configuration.action)
    }
    func timeline(for configuration: PickActionIntent, in context: Context) async -> Timeline<OneTapEntry> {
        Timeline(entries: [OneTapEntry(date: .now, action: configuration.action)], policy: .never)
    }
}

struct OneTapView: View {
    @Environment(\.widgetFamily) private var family
    var entry: OneTapEntry

    var body: some View {
        content
            .widgetURL(entry.action.url) // small & lock-screen widgets are one tap target
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: entry.action.symbol).font(.system(size: 22, weight: .medium))
            }
            .containerBackground(for: .widget) { Color.clear }
        case .accessoryRectangular:
            HStack(spacing: 6) {
                Image(systemName: entry.action.symbol).font(.system(size: 20, weight: .medium))
                VStack(alignment: .leading, spacing: 0) {
                    Text("Henalytics").font(.caption2).opacity(0.7)
                    Text("Log \(entry.action.shortLabel.lowercased())").font(.headline)
                }
            }
            .containerBackground(for: .widget) { Color.clear }
        default:
            VStack(spacing: 6) {
                ZStack {
                    Circle().fill(Color.henYolk).frame(width: 64, height: 64)
                    Image(systemName: entry.action.symbol)
                        .font(.system(size: 28, weight: .regular))
                        .foregroundStyle(Color.henOnYolk)
                }
                Text("Log \(entry.action.shortLabel.lowercased())")
                    .font(.system(size: 16, weight: .regular, design: .serif))
                    .foregroundStyle(Color.henInk)
                Text("tap to open")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.henInkSoft)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .containerBackground(for: .widget) { Color.henBg }
        }
    }
}

struct OneTapWidget: Widget {
    let kind = "HenalyticsOneTap"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: PickActionIntent.self, provider: OneTapProvider()) { entry in
            OneTapView(entry: entry)
        }
        .configurationDisplayName("One-Tap Log")
        .description("A single button for the thing you always forget. Long-press → Edit Widget to choose.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - Egg Counter (small + medium, interactive, one flock)

/// Taps waiting for the app: { flockId: { "yyyy-MM-dd": n } }, n may be
/// negative (− after the app already had eggs in the basket).
enum EggTallyStore {
    static let key = "eggTally"

    static func load() -> [String: [String: Int]] {
        guard let defaults = UserDefaults(suiteName: henAppGroup),
              let json = defaults.string(forKey: key),
              let data = json.data(using: .utf8),
              let value = try? JSONDecoder().decode([String: [String: Int]].self, from: data) else { return [:] }
        return value
    }

    static func save(_ value: [String: [String: Int]]) {
        guard let defaults = UserDefaults(suiteName: henAppGroup) else { return }
        if value.isEmpty {
            defaults.removeObject(forKey: key)
            return
        }
        if let data = try? JSONEncoder().encode(value), let json = String(data: data, encoding: .utf8) {
            defaults.set(json, forKey: key)
        }
    }

    static func pending(flockId: String, day: String) -> Int {
        load()[flockId]?[day] ?? 0
    }

    /// Adds `delta` for the day, never letting the shown count drop below 0
    /// (`floor` = minus what the app's basket already holds).
    static func add(flockId: String, day: String, delta: Int, floor: Int) {
        var all = load()
        var days = all[flockId] ?? [:]
        let next = max(floor, (days[day] ?? 0) + delta)
        if next == 0 {
            days.removeValue(forKey: day)
        } else {
            days[day] = next
        }
        all[flockId] = days.isEmpty ? nil : days
        save(all)
    }
}

enum FlockDirectory {
    static func flocks() -> [TodayFlock] { TodaySnapshot.load()?.flocks ?? [] }
    static func entities() -> [FlockEntity] { flocks().map { FlockEntity(id: $0.id, name: $0.name) } }
}

struct FlockEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Flock" }
    static var defaultQuery = FlockQuery()

    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct FlockQuery: EntityQuery {
    func entities(for identifiers: [FlockEntity.ID]) async throws -> [FlockEntity] {
        FlockDirectory.entities().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [FlockEntity] {
        FlockDirectory.entities()
    }

    func defaultResult() async -> FlockEntity? {
        FlockDirectory.entities().first
    }
}

struct PickFlockIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Choose a flock" }
    static var description: IntentDescription { "Count eggs for this flock." }

    @Parameter(title: "Flock")
    var flock: FlockEntity?
}

/// The + / − buttons. Runs in the widget, no app launch.
struct TallyEggsIntent: AppIntent {
    static var title: LocalizedStringResource { "Count eggs" }
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Flock")
    var flockId: String

    @Parameter(title: "Change")
    var delta: Int

    init() {}

    init(flockId: String, delta: Int) {
        self.flockId = flockId
        self.delta = delta
    }

    func perform() async throws -> some IntentResult {
        let day = henLocalDay(Date())
        let snap = TodaySnapshot.load()
        let base = snap?.day == day ? (snap?.flocks?.first(where: { $0.id == flockId })?.basket ?? 0) : 0
        EggTallyStore.add(flockId: flockId, day: day, delta: delta, floor: -base)
        return .result()
    }
}

struct EggTallyEntry: TimelineEntry {
    let date: Date
    let flock: TodayFlock?
    let count: Int
    let logged: Int
    let hasFlocks: Bool
}

struct EggTallyProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> EggTallyEntry {
        EggTallyEntry(date: .now, flock: TodayFlock(id: "", name: "The girls", emoji: "🐔", basket: 6, logged: 0),
                      count: 6, logged: 0, hasFlocks: true)
    }

    func snapshot(for configuration: PickFlockIntent, in context: Context) async -> EggTallyEntry {
        makeEntry(configuration, date: .now)
    }

    func timeline(for configuration: PickFlockIntent, in context: Context) async -> Timeline<EggTallyEntry> {
        // Now, and just after midnight so the count starts fresh each day.
        let cal = Calendar.current
        let midnight = cal.date(byAdding: .minute, value: 1, to: cal.startOfDay(for: cal.date(byAdding: .day, value: 1, to: .now)!))!
        return Timeline(entries: [makeEntry(configuration, date: .now), makeEntry(configuration, date: midnight)],
                        policy: .after(midnight))
    }

    private func makeEntry(_ configuration: PickFlockIntent, date: Date) -> EggTallyEntry {
        let day = henLocalDay(date)
        let snap = TodaySnapshot.load()
        let flocks = snap?.flocks ?? []
        guard let flock = flocks.first(where: { $0.id == configuration.flock?.id }) ?? flocks.first else {
            return EggTallyEntry(date: date, flock: nil, count: 0, logged: 0, hasFlocks: false)
        }
        let fresh = snap?.day == day
        let base = fresh ? (flock.basket ?? 0) : 0
        let logged = fresh ? (flock.logged ?? 0) : 0
        let count = max(0, base + EggTallyStore.pending(flockId: flock.id, day: day))
        return EggTallyEntry(date: date, flock: flock, count: count, logged: logged, hasFlocks: true)
    }
}

struct EggTallyView: View {
    @Environment(\.widgetFamily) private var family
    var entry: EggTallyEntry

    var body: some View {
        Group {
            if let flock = entry.flock {
                tally(flock)
            } else {
                VStack(spacing: 6) {
                    Image(systemName: "oval.portrait").font(.system(size: 30)).foregroundStyle(Color.henInk)
                    Text("Open Henalytics to add your flock")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.henInk)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .widgetURL(URL(string: "henalytics://open?page=egg_layers"))
        .containerBackground(for: .widget) { Color.henBg }
    }

    private func tally(_ flock: TodayFlock) -> some View {
        VStack(spacing: family == .systemSmall ? 2 : 4) {
            HStack(spacing: 4) {
                Text(flock.name)
                    .font(.system(size: 13, weight: .semibold, design: .serif))
                    .foregroundStyle(Color.henInk)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            Text("\(entry.count)")
                .font(.system(size: family == .systemSmall ? 40 : 44, weight: .regular, design: .serif))
                .foregroundStyle(Color.henInk)
                .contentTransition(.numericText())
            Text(entry.logged > 0 ? "\(entry.logged) more saved today" : "eggs today")
                .font(.system(size: 10))
                .foregroundStyle(Color.henInkSoft)
                .lineLimit(1)
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                tallyButton("−", flockId: flock.id, delta: -1, prominent: false)
                tallyButton("+", flockId: flock.id, delta: 1, prominent: true)
                if family != .systemSmall {
                    tallyButton("+6", flockId: flock.id, delta: 6, prominent: false)
                    tallyButton("+12", flockId: flock.id, delta: 12, prominent: false)
                }
            }
        }
    }

    private func tallyButton(_ label: String, flockId: String, delta: Int, prominent: Bool) -> some View {
        Button(intent: TallyEggsIntent(flockId: flockId, delta: delta)) {
            Text(label)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(prominent ? Color.henOnYolk : Color.henInk)
                .frame(maxWidth: .infinity, minHeight: 34)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(prominent ? Color.henYolk : Color.henCard))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(prominent ? Color.clear : Color.henLine, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct EggTallyWidget: Widget {
    let kind = "HenalyticsEggTally"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: PickFlockIntent.self, provider: EggTallyProvider()) { entry in
            EggTallyView(entry: entry)
        }
        .configurationDisplayName("Egg Counter")
        .description("Tap + as you collect. It saves to today on its own. Long-press → Edit Widget to pick a flock.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Bundle

@main
struct HenalyticsWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        QuickLogWidget()
        OneTapWidget()
        EggTallyWidget()
    }
}
