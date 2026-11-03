// ============================================================================
// Henalytics home-screen + lock-screen widgets (iOS 17+)
// ----------------------------------------------------------------------------
// Two widgets:
//   • "Quick Log"   — medium home-screen widget with four buttons.
//   • "One-Tap Log" — small home-screen OR lock-screen widget. Long-press →
//                     Edit Widget to choose what it logs (eggs, fed, water,
//                     note).
// Every tap opens the app straight into the matching log form via a
// henalytics:// link that HomesteadApp.jsx handles (see WIDGET DEEP LINKS).
// No data is shared with the app, so no App Group is needed.
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
}

// MARK: - Actions

enum LogAction: String, AppEnum, CaseIterable {
    case eggs, fed, water, note

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Log action" }
    static var caseDisplayRepresentations: [LogAction: DisplayRepresentation] {
        [
            .eggs: "Collect eggs",
            .fed: "Fed the chickens",
            .water: "Watered the garden",
            .note: "Quick note",
        ]
    }

    var emoji: String {
        switch self {
        case .eggs: return "🥚"
        case .fed: return "🌾"
        case .water: return "💧"
        case .note: return "📝"
        }
    }

    var shortLabel: String {
        switch self {
        case .eggs: return "Eggs"
        case .fed: return "Fed"
        case .water: return "Water"
        case .note: return "Note"
        }
    }

    var url: URL {
        switch self {
        case .eggs: return URL(string: "henalytics://log?hobby=egg_layers&action=eggs")!
        case .fed: return URL(string: "henalytics://log?hobby=egg_layers&action=fed")!
        case .water: return URL(string: "henalytics://log?hobby=garden&action=watered")!
        // hobby=any → whichever hobby you were last on
        case .note: return URL(string: "henalytics://log?hobby=any&action=note")!
        }
    }
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
                ForEach(LogAction.allCases, id: \.self) { action in
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
        .description("One tap to log eggs, feeding, watering or a note.")
        .supportedFamilies([.systemMedium])
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
        QuickLogWidget()
        OneTapWidget()
    }
}
