const googleSheetStats = async (funnel) => {
    try {
        const safePercentage = (percentage) => {
            if (isNaN(percentage) || percentage === -Infinity || percentage < 0) {
                return 0;
            }
            return percentage;
        };

        const dashboardCount = [
            [
                funnel.linkClicked.count,
                funnel.freeDemoStarted.count,
                funnel.freeDemoEnded.count,
                funnel.registeredUsers.count,
                funnel.selectedUsers.count,
                // funnel.purchasedUsers.count,
            ],
            [
                safePercentage(funnel.linkClicked.percentage) + "%",
                safePercentage(funnel.freeDemoStarted.percentage) + "%",
                safePercentage(funnel.freeDemoEnded.percentage) + "%",
                safePercentage(funnel.registeredUsers.percentage) + "%",
                safePercentage(funnel.selectedUsers.percentage) + "%",
                // safePercentage(funnel.purchasedUsers.percentage) + "%",
            ],
        ];
        return dashboardCount;
    } catch (error) {
        error.fileName = "googleSheetStats.js";
    }
};

export default googleSheetStats;
