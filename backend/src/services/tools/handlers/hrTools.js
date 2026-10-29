/**
 * HR & People Operations Domain Tool Handlers
 */
export const hrTools = {
  hr_submit_leave_request: async ({ employeeId, leaveType, startDate, endDate, reason }) => {
    return {
      success: true,
      leaveRequestId: `LV-${Date.now().toString().slice(-4)}`,
      employeeId,
      leaveType,
      dates: `${startDate} to ${endDate}`,
      status: 'pending_manager_approval',
      message: `Leave request submitted for ${leaveType} leave.`
    };
  },

  hr_get_leave_balance: async ({ employeeId }) => {
    return {
      success: true,
      employeeId,
      balances: {
        paidTimeOffRemaining: 14,
        sickLeaveRemaining: 8,
        casualLeaveRemaining: 4,
        compensatoryOffRemaining: 2
      },
      nextCompanyHoliday: 'Diwali Break (2026-11-01)'
    };
  },

  hr_query_handbook: async ({ question }) => {
    return {
      success: true,
      question,
      relevantPolicy: 'Kiaan Employee Benefits & Remote Work Policy (Section 4.2)',
      answer: 'Full-time employees are eligible for an annual remote work workstation stipend of $500/year, and standard work hours are flexible between 9:00 AM and 6:30 PM with core overlap hours from 11:00 AM to 4:00 PM.'
    };
  },

  hr_schedule_interview: async ({ candidateName, interviewerEmail, dateTime, round = 'technical' }) => {
    return {
      success: true,
      calendarEventId: `CAL-${Date.now().toString().slice(-4)}`,
      candidateName,
      interviewerEmail,
      dateTime,
      round,
      meetingUrl: 'https://meet.kiaantechnology.online/interview-room-4',
      status: 'confirmed'
    };
  },

  hr_log_attendance: async ({ employeeId, action }) => {
    return {
      success: true,
      employeeId,
      action,
      timestamp: new Date().toISOString(),
      locationVerified: true,
      message: `Attendance logged successfully: ${action === 'check_in' ? 'Clocked In' : 'Clocked Out'}.`
    };
  },

  hr_get_paystub_summary: async ({ employeeId, monthYear }) => {
    return {
      success: true,
      employeeId,
      period: monthYear || '2026-10',
      grossSalary: '$4,200.00',
      deductions: '$450.00 (Provident Fund + Health Insurance)',
      taxWithholding: '$520.00',
      netPayable: '$3,230.00',
      status: 'disbursed_on_28th',
      downloadPdf: `/api/hr/paystubs/${employeeId}-${monthYear}.pdf`
    };
  }
};

