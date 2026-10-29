import Observation

/// The selected tab, so a screen can send the user to another tab (Home's
/// "Timeline" link, a device's latest clip).
@MainActor
@Observable
final class TabRouter {
    enum Tab: Hashable { case home, timeline, pets, server }

    var tab: Tab = .home
    /// A device to filter the timeline by when it opens, if any.
    var timelineDeviceID: String?
}
