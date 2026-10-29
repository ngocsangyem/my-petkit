import Foundation

/// Byte counts as a person reads them, in binary units (the server sizes
/// files and caps in KiB/MiB but labels them KB/MB, as the web panel does).
/// One decimal below ten units, whole numbers above: "2.4 MB", "880 KB".
enum ByteSize {
    private static let units = ["KB", "MB", "GB", "TB"]

    static func format(_ bytes: Int) -> String {
        guard bytes >= 1024 else { return "\(max(bytes, 0)) B" }
        var value = Double(bytes)
        var unit = -1
        while value >= 1024, unit < units.count - 1 {
            value /= 1024
            unit += 1
        }
        return "\(number(value)) \(units[unit])"
    }

    /// A cap given in megabytes, as `/api/retention` stores it: 1024 → "1 GB".
    static func format(megabytes: Double) -> String {
        format(Int((megabytes * 1024 * 1024).rounded()))
    }

    private static func number(_ value: Double) -> String {
        // Rounding first keeps 9.96 from printing as "10.0".
        let tenths = (value * 10).rounded() / 10
        if tenths >= 10 || tenths == tenths.rounded() {
            return String(Int(value.rounded()))
        }
        return String(format: "%.1f", tenths)
    }
}
