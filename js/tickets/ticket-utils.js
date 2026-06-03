const TICKET_STATUS = {
  SUBMITTED: 'submitted',
  AWAITING_DISPATCH: 'awaiting_dispatch',
  NEEDS_REVIEW: 'needs_review',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled'
};

const TICKET_STATUS_LABELS = {
  [TICKET_STATUS.SUBMITTED]: 'Submitted',
  [TICKET_STATUS.AWAITING_DISPATCH]: 'Awaiting Dispatch',
  [TICKET_STATUS.NEEDS_REVIEW]: 'Needs Review',
  [TICKET_STATUS.ASSIGNED]: 'Assigned',
  [TICKET_STATUS.IN_PROGRESS]: 'In Progress',
  [TICKET_STATUS.ESCALATED]: 'Escalated',
  [TICKET_STATUS.RESOLVED]: 'Resolved',
  [TICKET_STATUS.CANCELLED]: 'Cancelled'
};

const TICKET_STATUSES = [
  { value: TICKET_STATUS.SUBMITTED, label: TICKET_STATUS_LABELS[TICKET_STATUS.SUBMITTED] },
  { value: TICKET_STATUS.AWAITING_DISPATCH, label: TICKET_STATUS_LABELS[TICKET_STATUS.AWAITING_DISPATCH] },
  { value: TICKET_STATUS.NEEDS_REVIEW, label: TICKET_STATUS_LABELS[TICKET_STATUS.NEEDS_REVIEW] },
  { value: TICKET_STATUS.ASSIGNED, label: TICKET_STATUS_LABELS[TICKET_STATUS.ASSIGNED] },
  { value: TICKET_STATUS.IN_PROGRESS, label: TICKET_STATUS_LABELS[TICKET_STATUS.IN_PROGRESS] },
  { value: TICKET_STATUS.ESCALATED, label: TICKET_STATUS_LABELS[TICKET_STATUS.ESCALATED] },
  { value: TICKET_STATUS.RESOLVED, label: TICKET_STATUS_LABELS[TICKET_STATUS.RESOLVED] },
  { value: TICKET_STATUS.CANCELLED, label: TICKET_STATUS_LABELS[TICKET_STATUS.CANCELLED] }
];

function normalizeTicketStatus(status) {
  const s = String(status || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  const map = {
    submitted: TICKET_STATUS.SUBMITTED,
    awaiting_dispatch: TICKET_STATUS.AWAITING_DISPATCH,
    needs_review: TICKET_STATUS.NEEDS_REVIEW,
    assigned: TICKET_STATUS.ASSIGNED,
    in_progress: TICKET_STATUS.IN_PROGRESS,
    escalated: TICKET_STATUS.ESCALATED,
    resolved: TICKET_STATUS.RESOLVED,

    cancelled: TICKET_STATUS.CANCELLED
  };

  return map[s] || TICKET_STATUS.SUBMITTED;
}

function ticketStatusLabel(status) {
  return TICKET_STATUS_LABELS[normalizeTicketStatus(status)] || 'Submitted';
}

function isTicketClosed(status) {
  const s = normalizeTicketStatus(status);
  return s === TICKET_STATUS.RESOLVED || s === TICKET_STATUS.CANCELLED;
}

function isTicketOpen(status) {
  return !isTicketClosed(status);
}

function isTicketInProgress(status) {
  return normalizeTicketStatus(status) === TICKET_STATUS.IN_PROGRESS;
}

function ticketStatusEquals(status, expected) {
  return normalizeTicketStatus(status) === expected;
}







function populateTicketPrioritySelect(selectEl, placeholder = 'Select priority') {
  if (!selectEl) return;

  selectEl.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  selectEl.appendChild(first);

  const priorities = ['Low', 'Medium', 'High', 'Critical'];

  priorities.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    selectEl.appendChild(opt);
  });
}


function populateTicketStatusSelect(selectEl, placeholder = 'All statuses') {


  if (!selectEl) return;


  selectEl.innerHTML = '';


  const first = document.createElement('option');


  first.value = '';


  first.textContent = placeholder;


  selectEl.appendChild(first);


  TICKET_STATUSES.forEach(({ value, label }) => {


    const opt = document.createElement('option');


    opt.value = value;


    opt.textContent = label;


    selectEl.appendChild(opt);


  });


}





// ===== New Ticket modal: multi-assignee draft state =====


