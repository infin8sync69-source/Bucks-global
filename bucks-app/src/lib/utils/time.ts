
const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

export function formatRelativeTime(timestamp: number): string {
    const seconds = Math.round((Date.now() - timestamp) / 1000);

    if (seconds < MINUTE) {
        return `${seconds}s ago`;
    } else if (seconds < HOUR) {
        return `${Math.floor(seconds / MINUTE)}m ago`;
    } else if (seconds < DAY) {
        return `${Math.floor(seconds / HOUR)}h ago`;
    } else if (seconds < WEEK) {
        return `${Math.floor(seconds / DAY)}d ago`;
    } else if (seconds < MONTH) {
        return `${Math.floor(seconds / WEEK)}w ago`;
    } else if (seconds < YEAR) {
        return `${Math.floor(seconds / MONTH)}mo ago`;
    } else {
        return `${Math.floor(seconds / YEAR)}y ago`;
    }
}
