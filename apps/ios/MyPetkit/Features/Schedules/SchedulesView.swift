import PetkitCore
import SwiftUI

/// A device's schedule editor (`ios-schedules`), pushed from its detail.
struct SchedulesView: View {
    let deviceID: String

    var body: some View {
        Text("Schedules").font(Theme.Font.body)
    }
}
