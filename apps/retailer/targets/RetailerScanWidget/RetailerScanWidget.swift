import SwiftUI
import WidgetKit

private let appGroup = "group.com.theloyaltyloop.retailer"
private let stateKey = "loyalty-loop:retailer-widget"

struct RetailerWidgetEntry: TimelineEntry {
  let date: Date
  let businessName: String
  let todayActions: Int
  let members: Int
}

struct RetailerWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> RetailerWidgetEntry { example }
  func getSnapshot(in context: Context, completion: @escaping (RetailerWidgetEntry) -> Void) { completion(readEntry()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<RetailerWidgetEntry>) -> Void) {
    completion(Timeline(entries: [readEntry()], policy: .after(Date().addingTimeInterval(30 * 60))))
  }

  private var example: RetailerWidgetEntry { RetailerWidgetEntry(date: Date(), businessName: "Your business", todayActions: 12, members: 86) }
  private func readEntry() -> RetailerWidgetEntry {
    let values = UserDefaults(suiteName: appGroup)?.dictionary(forKey: stateKey)
    return RetailerWidgetEntry(date: Date(), businessName: values?["businessName"] as? String ?? "The Loyalty Loop", todayActions: values?["todayActions"] as? Int ?? 0, members: values?["members"] as? Int ?? 0)
  }
}

struct RetailerScanWidgetView: View {
  let entry: RetailerWidgetEntry
  var body: some View {
    Link(destination: URL(string: "loyaltyloop-business://widget/scan")!) {
      VStack(alignment: .leading, spacing: 8) {
        Text(entry.businessName).font(.headline).lineLimit(1).foregroundStyle(.white)
        Spacer(minLength: 0)
        Text("SCAN CUSTOMER").font(.caption.weight(.bold)).foregroundStyle(Color(red: 0.94, green: 0.44, blue: 0.21))
        Text(entry.todayActions == 1 ? "1 loyalty action today" : "\(entry.todayActions) loyalty actions today")
          .font(.subheadline).foregroundStyle(.white).lineLimit(2)
        HStack {
          Text("\(entry.members) members").font(.caption).foregroundStyle(.gray)
          Spacer()
          Text("Open scanner  →").font(.caption.weight(.bold)).foregroundStyle(.white)
        }
      }
      .containerBackground(for: .widget) { Color(red: 0.114, green: 0.129, blue: 0.11) }
    }
  }
}

struct RetailerScanWidget: Widget {
  let kind = "RetailerScanWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: RetailerWidgetProvider()) { entry in RetailerScanWidgetView(entry: entry) }
      .configurationDisplayName("Open scanner")
      .description("Open the customer scanner and see today's activity.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct RetailerScanWidgetBundle: WidgetBundle {
  var body: some Widget { RetailerScanWidget() }
}
