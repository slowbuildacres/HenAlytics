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
// Every tap opens the app straight into the matching log form via a
// henalytics:// link that HomesteadApp.jsx handles (see WIDGET DEEP LINKS).
// ============================================================================

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Brand colors (match the app's palette)

private extension Color {
    static let henBg = Color(red: 0xF4 / 255, green: 0xED / 255, blue: 0xE0 / 255)
    static let henCard = Color(red: 0xFA / 255, green: 0xF5 / 255, blue: 0xEA / 255)
    static let henInk = Color(red: 0x2C / 255, green: 0x18 / 255, blue: 0x10 / 255)
    static let henInkSoft = Color(red: 0x5C / 255, green: 0x45 / 255, blue: 0x30 / 255)
    static let henYolk = Color(red: 0xE8 / 255, green: 0xB5 / 255, blue: 0x47 / 255)
    static let henAccent = Color(red: 0xC8 / 255, green: 0x4B / 255, blue: 0x31 / 255)
    static let henFrostBg = Color(red: 0xFB / 255, green: 0xE5 / 255, blue: 0xDE / 255)
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
                .font(.system(size: 13, weight: .semibold, design: .serif))
                .foregroundStyle(Color.henInkSoft)
            HStack(spacing: 8) {
                ForEach(LogAction.quickLog, id: \.self) { action in
                    Link(destination: action.url) {
                        VStack(spacing: 4) {
                            Text(action.emoji).font(.system(size: 26))
                            Text(action.shortLabel)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.henInk)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.henCard)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color.henInk.opacity(0.18), lineWidth: 1)
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

struct TodaySnapshot: Decodable {
    struct Frost: Decodable { let lowText: String; let crops: [String]? }
    struct Task: Decodable { let date: String; let title: String }
    let day: String
    let name: String?
    let eggsToday: Int?
    let frost: Frost?
    let tasks: [Task]?

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
                    .font(.system(size: 15, weight: .semibold, design: .serif))
                    .foregroundStyle(Color.henInk)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(entry.date, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                    .font(.system(size: 11))
                    .foregroundStyle(Color.henInkSoft)
            }
            if let frost = frostLine {
                Text("❄️ \(frost)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.henAccent)
                    .lineLimit(2)
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.henFrostBg))
            }
            if let eggs = eggsLine {
                Text("🥚 \(eggs)").font(.system(size: 12)).foregroundStyle(Color.henInk).lineLimit(1)
            }
            if entry.snapshot == nil {
                Text("Open Henalytics once to fill this in.")
                    .font(.system(size: 12)).foregroundStyle(Color.henInkSoft)
            } else if tasks.isEmpty {
                Text("📅 Nothing on the calendar this week")
                    .font(.system(size: 12)).foregroundStyle(Color.henInkSoft).lineLimit(1)
            } else {
                ForEach(Array(tasks.prefix(maxTasks).enumerated()), id: \.offset) { _, t in
                    Text("📅 \(dayLabel(t.date)) · \(t.title)")
                        .font(.system(size: 12)).foregroundStyle(Color.henInk).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                ForEach([LogAction.eggs, .harvest, .note], id: \.self) { action in
                    Link(destination: action.url) {
                        Text("\(action.emoji) \(action.shortLabel)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.henInk)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.henCard))
                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color.henInk.opacity(0.18), lineWidth: 1))
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
                Text(entry.action.emoji).font(.system(size: 24))
            }
            .containerBackground(for: .widget) { Color.clear }
        case .accessoryRectangular:
            HStack(spacing: 6) {
                Text(entry.action.emoji).font(.system(size: 22))
                VStack(alignment: .leading, spacing: 0) {
                    Text("Henalytics").font(.caption2).opacity(0.7)
                    Text("Log \(entry.action.shortLabel.lowercased())").font(.headline)
                }
            }
            .containerBackground(for: .widget) { Color.clear }
        default:
            VStack(spacing: 6) {
                Text(entry.action.emoji).font(.system(size: 46))
                Text("Log \(entry.action.shortLabel.lowercased())")
                    .font(.system(size: 15, weight: .semibold, design: .serif))
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

// MARK: - Bundle

@main
struct HenalyticsWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        QuickLogWidget()
        OneTapWidget()
    }
}
