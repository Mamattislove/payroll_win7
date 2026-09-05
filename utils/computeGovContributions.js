import SSSRate from "../models/SSSRate.js";
import PhilHealthRate from "../models/PhilHealthRate.js";
import PagIbigRate from "../models/PagIbigRate.js";

const r2 = (n) => Math.round(n * 100) / 100;

async function getSSSBracket(monthlyRate, year) {
    let bracket = await SSSRate.findOne({
        year,
        $and: [
            { $or: [{ compensationFrom: null }, { compensationFrom: { $lte: monthlyRate } }] },
            { $or: [{ compensationTo: null }, { compensationTo: { $gte: monthlyRate } }] },
        ],
    }).sort({ msc: 1 });

    if (!bracket) {
        bracket = await SSSRate.findOne({
            $and: [
                { $or: [{ compensationFrom: null }, { compensationFrom: { $lte: monthlyRate } }] },
                { $or: [{ compensationTo: null }, { compensationTo: { $gte: monthlyRate } }] },
            ],
        })
            .sort({ year: -1, msc: 1 })
            .limit(1);
    }

    return bracket;
}

async function getSSSContributions(monthlyRate, year) {
    const bracket = await getSSSBracket(monthlyRate, year);

    if (!bracket) {
        console.warn(`[computeGovContributions] No SSS bracket found for year=${year}, monthlyRate=${monthlyRate}.`);
        return { employee: 0, employer: 0 };
    }

    return {
        employee: r2(bracket.totalEmployeeContribution),
        employer: r2(bracket.totalEmployerContribution),
    };
}

async function getPhilHealthContributions(monthlyRate, year) {
    let rate = await PhilHealthRate.findOne({ year });
    if (!rate) rate = await PhilHealthRate.findOne().sort({ year: -1 });
    if (!rate) {
        console.warn(`[computeGovContributions] No PhilHealth rate found for year=${year}.`);
        return { employee: 0, employer: 0 };
    }

    const { premiumRate, employeeShare, minimumSalaryThreshold, deductionCeiling } = rate;

    let salary = monthlyRate;
    if (minimumSalaryThreshold && salary < minimumSalaryThreshold) salary = minimumSalaryThreshold;
    if (deductionCeiling && salary > deductionCeiling) salary = deductionCeiling;

    return {
        employee: r2(salary * premiumRate * employeeShare),
        employer: r2(salary * premiumRate * (1 - employeeShare)),
    };
}

async function getPagIbigContributions(monthlyRate, year) {
    let rate = await PagIbigRate.findOne({ year });
    if (!rate) rate = await PagIbigRate.findOne().sort({ year: -1 });
    if (!rate) {
        console.warn(`[computeGovContributions] No Pag-IBIG rate found for year=${year}.`);
        return { employee: 0, employer: 0 };
    }

    const {
        incomeCeiling,
        basicEmployeeShare,
        basicEmployerShare,
        overThresholdEmployeeShare,
        overThresholdEmployerShare,
        percentageRateSalaryThreshold,
        flatRateMaxDeduction,
    } = rate;

    let employeeContribution;
    let employerContribution;

    if (monthlyRate <= incomeCeiling) {
        employeeContribution = monthlyRate * basicEmployeeShare;
        employerContribution = monthlyRate * basicEmployerShare;
    } else {
        const base = percentageRateSalaryThreshold
            ? Math.min(monthlyRate, percentageRateSalaryThreshold)
            : monthlyRate;
        employeeContribution = base * overThresholdEmployeeShare;
        employerContribution = base * overThresholdEmployerShare;
    }

    if (flatRateMaxDeduction && employeeContribution > flatRateMaxDeduction) {
        employeeContribution = flatRateMaxDeduction;
    }

    return {
        employee: r2(employeeContribution),
        employer: r2(employerContribution),
    };
}

/**
 * Computes SSS, PhilHealth, and Pag-IBIG contributions for both employee and employer.
 *
 * @param {object} compensation - Mongoose Compensation document
 * @param {number} year - Payroll year (from payrollFrom date)
 * @returns {{ sssContribution, philhealthContribution, pagibigContribution,
 *             sssEmployerContribution, philhealthEmployerContribution, pagibigEmployerContribution }}
 */
export async function computeGovContributions(compensation, year) {
    const {
        monthlyRate = 0,
        sssContributionBasis,
        philhealthContributionBasis,
        pagibigContributionBasis,
        sssOverwriteAmount = 0,
        philhealthOverwriteAmount = 0,
        pagibigOverwriteAmount = 0,
    } = compensation;

    const [sss, ph, pi] = await Promise.all([
        sssContributionBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : sssOverwriteAmount > 0
              ? { employee: r2(sssOverwriteAmount), employer: 0 }
              : getSSSContributions(monthlyRate, year),

        philhealthContributionBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : philhealthOverwriteAmount > 0
              ? { employee: r2(philhealthOverwriteAmount), employer: 0 }
              : getPhilHealthContributions(monthlyRate, year),

        pagibigContributionBasis === "no deduction"
            ? { employee: 0, employer: 0 }
            : pagibigOverwriteAmount > 0
              ? { employee: r2(pagibigOverwriteAmount), employer: 0 }
              : getPagIbigContributions(monthlyRate, year),
    ]);

    return {
        sssContribution:              sss.employee,
        philhealthContribution:       ph.employee,
        pagibigContribution:          pi.employee,
        sssEmployerContribution:      sss.employer,
        philhealthEmployerContribution: ph.employer,
        pagibigEmployerContribution:  pi.employer,
    };
}
