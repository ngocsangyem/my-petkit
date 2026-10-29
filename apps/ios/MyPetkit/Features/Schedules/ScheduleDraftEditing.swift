import Foundation

/// Row edits on a working copy. A nil index appends; an index out of range
/// (the served value changed under an open sheet) changes nothing, and an
/// edit of the wrong kind is ignored rather than turning one shape into another.
extension ScheduleDraft {
    mutating func put(_ range: ScheduleRange, at index: Int?) {
        guard case .ranges(var ranges) = self else { return }
        Self.put(range, at: index, in: &ranges)
        self = .ranges(ranges)
    }

    mutating func put(_ entry: WeeklyEntry, at index: Int?) {
        guard case .weekly(var entries) = self else { return }
        Self.put(entry, at: index, in: &entries)
        self = .weekly(entries)
    }

    mutating func put(_ point: PointEntry, at index: Int?) {
        guard case .points(var points) = self else { return }
        Self.put(point, at: index, in: &points)
        self = .points(points)
    }

    /// A meal added to a feeder with no sets yet starts an every-day set.
    mutating func put(_ meal: FeedMeal, group: Int, at index: Int?) {
        guard case .feed(var groups) = self else { return }
        if groups.isEmpty && index == nil {
            groups.append(FeedGroup(days: .everyDay, meals: []))
        }
        guard groups.indices.contains(group) else { return }
        Self.put(meal, at: index, in: &groups[group].meals)
        self = .feed(groups)
    }

    mutating func removeRow(_ editing: ScheduleEditing) {
        switch (self, editing) {
        case (.ranges(var rows), .range(let index?)) where rows.indices.contains(index):
            rows.remove(at: index)
            self = .ranges(rows)
        case (.weekly(var rows), .weekly(let index?)) where rows.indices.contains(index):
            rows.remove(at: index)
            self = .weekly(rows)
        case (.points(var rows), .point(let index?, _)) where rows.indices.contains(index):
            rows.remove(at: index)
            self = .points(rows)
        case (.feed(var groups), .meal(let group, let index?))
            where groups.indices.contains(group) && groups[group].meals.indices.contains(index):
            groups[group].meals.remove(at: index)
            self = .feed(groups)
        default:
            break
        }
    }

    mutating func setEnabled(_ enabled: Bool, weeklyAt index: Int) {
        guard case .weekly(var entries) = self, entries.indices.contains(index) else { return }
        entries[index].enabled = enabled
        self = .weekly(entries)
    }

    mutating func setDays(_ days: WeekdaySet, groupAt index: Int) {
        guard case .feed(var groups) = self, groups.indices.contains(index) else { return }
        groups[index].days = days
        self = .feed(groups)
    }

    /// A new set starts on every day and empty; its days are picked next.
    mutating func addFeedGroup() {
        guard case .feed(var groups) = self else { return }
        groups.append(FeedGroup(days: .everyDay, meals: []))
        self = .feed(groups)
    }

    mutating func removeFeedGroup(at index: Int) {
        guard case .feed(var groups) = self, groups.indices.contains(index) else { return }
        groups.remove(at: index)
        self = .feed(groups)
    }

    /// The id a new point gets: the cloud hands both job types ids from one pool.
    var nextPointID: Int {
        guard case .points(let points) = self else { return 1 }
        return Self.nextID(points.map { .int($0.serverID) })
    }

    /// The id a new meal gets; the server turns a number into `n_<seconds>`.
    var nextMealID: Int {
        guard case .feed(let groups) = self else { return 1 }
        return Self.nextID(groups.flatMap(\.meals).map(\.mealID))
    }

    private static func put<Row>(_ row: Row, at index: Int?, in rows: inout [Row]) {
        if let index {
            guard rows.indices.contains(index) else { return }
            rows[index] = row
        } else {
            rows.append(row)
        }
    }
}
