import Attendance from "../models/Attendance.js";
import Compensation from "../models/Compensation.js";
import Payroll from "../models/Payroll.js";
import { computePayroll } from "./computePayroll.js";
import { recomputePayrollTotals } from "./recomputePayroll.js";

/**
 * Re-derives a payroll's attendance-based pay from the attendance itself.
 *
 * The pay buckets on a Payroll are a snapshot taken the moment it was
 * generated. Nothing used to refresh them, so keying in timekeeping after the
 * run — or correcting a day afterwards — left the payroll frozen at whatever
 * the attendance happened to say at generation time, and the payroll journal
 * printed those stale figures. Anything that edits attendance calls this so
 * the two stay in step.
 *
 * Attendance is re-read by date range rather than from `payroll.attendance`,
 * so days added after the run are picked up rather than ignored, and the link
 * array is refreshed to match.
 *
 * Payrolls flagged `locked` are left alone — see below.
 */
export async function syncPayrollAttendance(payrollId) {
    const payroll = await Payroll.findById(payrollId).select(
        "compensation payrollFrom payrollTo locked",
    );
    if (!payroll) return null;

    // A locked payroll has been paid. Re-deriving it would restate money
    // already disbursed and make an issued payroll journal disagree with
    // itself on reprint, so leave it exactly as it was paid. Discrepancies
    // against the timekeeping belong in the variance report instead
    // (seeders/exportPayrollVariance.js).
    if (payroll.locked) return Payroll.findById(payrollId);

    const attendances = await Attendance.find({
        compensation: payroll.compensation,
        attendanceDate: { $gte: payroll.payrollFrom, $lte: payroll.payrollTo },
    });

    // Payrolls up to May 2026 were imported from the previous system without
    // their timekeeping. Re-deriving from an empty attendance set would read as
    // "worked nothing" and wipe their pay, so leave those figures untouched and
    // only refresh the totals built on top of them.
    if (attendances.length === 0) return recomputePayrollTotals(payrollId);

    const compensation = await Compensation.findById(
        payroll.compensation,
    ).select("dailyRate");

    const computed = computePayroll(attendances, compensation?.dailyRate ?? 0);

    await Payroll.findByIdAndUpdate(payrollId, {
        attendance: attendances.map((a) => a._id),
        regularPay: computed.regularPay,
        regularOTPay: computed.regularOtPay,
        holidayRestDayPay: computed.holidayRestDayPay,
        holidayRestDayOTPay: computed.holidayRestDayOtPay,
        nightDifferentialPay: computed.nightDiffPay,
        leavePay: computed.leavePay,
        absences: computed.absences,
        late: computed.late,
        undertime: computed.undertime,
        daysWorked: computed.daysWorked,
        leaveDays: computed.leaveDays,
    });

    return recomputePayrollTotals(payrollId);
}

/**
 * Syncs every payroll whose period covers any of the given attendance dates.
 * Used by the attendance endpoints, which know what changed but not which pay
 * period it lands in.
 */
export async function syncPayrollsCoveringDates(compensationId, dates) {
    const valid = dates.map((d) => new Date(d)).filter((d) => !isNaN(d));
    if (!compensationId || valid.length === 0) return 0;

    const payrolls = await Payroll.find({
        compensation: compensationId,
        payrollFrom: { $lte: new Date(Math.max(...valid)) },
        payrollTo: { $gte: new Date(Math.min(...valid)) },
    }).select("_id payrollFrom payrollTo");

    const covering = payrolls.filter((p) =>
        valid.some((d) => d >= p.payrollFrom && d <= p.payrollTo),
    );

    for (const p of covering) await syncPayrollAttendance(p._id);
    return covering.length;
}
