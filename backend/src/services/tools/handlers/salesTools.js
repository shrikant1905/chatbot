/**
 * Sales & CRM Domain Tool Handlers
 */
export const salesTools = {
  crm_search_leads: async ({ query, status = 'all', limit = 5 }, context) => {
    // Deterministic simulation / DB lookup
    const mockLeads = [
      { id: 'lead-101', name: 'Vikram Sharma', company: 'Apex Logistics', email: 'vikram@apex.in', status: 'qualified', value: 15000 },
      { id: 'lead-102', name: 'Sarah Jenkins', company: 'CloudWave SaaS', email: 'sarah@cloudwave.io', status: 'contacted', value: 8500 },
      { id: 'lead-103', name: 'Rajesh Patel', company: 'Patel Exports', email: 'rajesh@patelexports.com', status: 'new', value: 24000 }
    ];

    const filtered = mockLeads.filter(
      (l) =>
        (status === 'all' || l.status === status) &&
        (l.name.toLowerCase().includes(query.toLowerCase()) ||
          l.company.toLowerCase().includes(query.toLowerCase()) ||
          l.email.toLowerCase().includes(query.toLowerCase()))
    );

    return {
      success: true,
      query,
      count: filtered.length,
      leads: filtered.slice(0, limit)
    };
  },

  crm_create_lead: async ({ name, company, email, phone, source = 'website', estimatedValue = 0 }, context) => {
    const leadId = `lead-${Date.now().toString().slice(-4)}`;
    return {
      success: true,
      message: `Lead successfully created for ${name} (${company || 'Individual'}).`,
      lead: {
        id: leadId,
        name,
        company,
        email,
        phone,
        source,
        estimatedValue,
        stage: 'new',
        createdAt: new Date().toISOString()
      }
    };
  },

  crm_update_deal_stage: async ({ dealId, newStage, probabilityPercent }, context) => {
    return {
      success: true,
      message: `Deal ${dealId} moved to stage '${newStage}'.`,
      dealId,
      newStage,
      probabilityPercent: probabilityPercent || (newStage === 'closed_won' ? 100 : newStage === 'proposal' ? 60 : 40),
      updatedAt: new Date().toISOString()
    };
  },

  crm_log_interaction: async ({ contactId, channel, summary, nextFollowUpDate }, context) => {
    return {
      success: true,
      message: `Logged ${channel} interaction for contact ${contactId}.`,
      logId: `log-${Date.now().toString().slice(-4)}`,
      contactId,
      channel,
      summary,
      nextFollowUpDate: nextFollowUpDate || 'None set'
    };
  },

  crm_summarize_account: async ({ accountId }, context) => {
    return {
      success: true,
      accountId,
      accountName: 'Acme Enterprise Solutions',
      tier: 'Enterprise Platinum',
      activeDealsCount: 2,
      totalPipelineValue: '$42,500',
      recentActivities: [
        'Demo conducted on 2026-10-24 by Alex Morgan',
        'Proposal v2 submitted on 2026-10-27'
      ],
      openSupportTickets: 0
    };
  }
};

