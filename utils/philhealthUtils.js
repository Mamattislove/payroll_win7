/**
 * Calculates PhilHealth contribution based on the year/version
 * @param {number} monthlySalary - Monthly basic salary in PHP
 * @param {number} year - Contribution year (2019 to 2025)
 * @returns {{ rate: number, totalContribution: number, employeeShare: number, employerShare: number }}
 */

const PHILHEALTH_TABLE = {
    2019: { rate: 0.0275, floor: 10000, ceiling: 50000 },
    2020: { rate: 0.03, floor: 10000, ceiling: 60000 },
    2021: { rate: 0.035, floor: 10000, ceiling: 70000 },
    2022: { rate: 0.04, floor: 10000, ceiling: 80000 },
    2023: { rate: 0.04, floor: 10000, ceiling: 80000 }, // suspended, kept at 4%
    2024: { rate: 0.05, floor: 10000, ceiling: 100000 },
    2025: { rate: 0.05, floor: 10000, ceiling: 100000 },
};

export const computePhilHealthByYear = (monthlySalary, year = 2025) => {
    const config = PHILHEALTH_TABLE[year];

    if (!config) {
        throw new Error(
            `No PhilHealth table found for year ${year}. Supported years: ${Object.keys(PHILHEALTH_TABLE).join(", ")}`,
        );
    }

    const { rate, floor, ceiling } = config;

    const applicableSalary = Math.min(Math.max(monthlySalary, floor), ceiling);
    const totalContribution = applicableSalary * rate;
    const share = totalContribution / 2;

    return {
        year,
        rate: `${rate * 100}%`,
        totalContribution,
        employeeShare: share,
        employerShare: share,
    };
};
