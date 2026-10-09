/* ==========================================================
   app.js
   CDS tracker logic. Depends on the globals in data.js.
   ========================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'nysc-rivers-cds-v1';
  var CUR = monthKey(0);
  var PREV = monthKey(-1);

  var members = loadMembers();
  var editingId = null;
  var confirmAction = null;
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  var el = {
    summary: $('summary'),
    tbody: $('tbody'),
    count: $('count'),
    empty: $('empty'),
    search: $('search'),
    filterCds: $('filterCds'),
    filterPay: $('filterPay'),
    filterPayLabel: $('filterPayLabel'),
    addBtn: $('addBtn'),
    resetBtn: $('resetBtn'),
    formDialog: $('formDialog'),
    form: $('memberForm'),
    formTitle: $('formTitle'),
    submitForm: $('submitForm'),
    cancelForm: $('cancelForm'),
    codePrefix: $('codePrefix'),
    codeNumber: $('codeNumber'),
    genCode: $('genCode'),
    lga: $('lga'),
    cds: $('cds'),
    paidCurLabel: $('paidCurLabel'),
    paidPrevLabel: $('paidPrevLabel'),
    confirmDialog: $('confirmDialog'),
    confirmTitle: $('confirmTitle'),
    confirmMessage: $('confirmMessage'),
    confirmOk: $('confirmOk'),
    confirmCancel: $('confirmCancel'),
    toast: $('toast')
  };

  /* ---------- Storage ---------- */

  function loadMembers() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('Could not read saved data, using sample data.', err);
    }
    return buildSampleMembers();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    } catch (err) {
      console.warn('Could not save data.', err);
      showToast('Changes could not be saved in this browser.');
    }
  }

  /* ---------- Small helpers ---------- */

  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else node.setAttribute(key, value === true ? '' : value);
      });
    }
    appendChildren(node, Array.prototype.slice.call(arguments, 2));
    return node;
  }

  function appendChildren(node, children) {
    children.forEach(function (child) {
      if (Array.isArray(child)) return appendChildren(node, child);
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function fullCode(m) {
    return STATE_CODE_PREFIX + m.codeNumber;
  }

  function parseIso(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function formatDate(iso) {
    return parseIso(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function monthLabel(key) {
    var p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  function daysUntil(iso) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((parseIso(iso) - today) / 86400000);
  }

  function endOfMonthIso() {
    var d = new Date();
    var e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return e.getFullYear() + '-' + pad2(e.getMonth() + 1) + '-' + pad2(e.getDate());
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function naira(n) {
    return '\u20A6' + n.toLocaleString('en-NG');
  }

  function newId() {
    return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function emptyAttendance() {
    var a = [];
    for (var i = 0; i < ATTENDANCE_WEEKS; i++) a.push(null);
    return a;
  }

  /* ---------- Calculations ---------- */

  function attendanceStats(m) {
    var recorded = m.attendance.filter(function (v) { return v === 0 || v === 1; });
    var present = recorded.filter(function (v) { return v === 1; }).length;
    return {
      present: present,
      recorded: recorded.length,
      pct: recorded.length ? Math.round((present / recorded.length) * 100) : null
    };
  }

  function clearanceStatus(m) {
    if (m.cleared) return { key: 'cleared', label: 'Cleared' };
    var days = daysUntil(m.clearanceDate);
    if (days < 0) return { key: 'overdue', label: 'Overdue by ' + plural(-days, 'day') };
    if (days === 0) return { key: 'due', label: 'Due today' };
    if (days <= CLEARANCE_WARNING_DAYS) return { key: 'due', label: 'Due in ' + plural(days, 'day') };
    return { key: 'upcoming', label: 'Upcoming' };
  }

  function isPaid(m, key) {
    return !!(m.allowance && m.allowance[key]);
  }

  /* ---------- Summary ---------- */

  function renderSummary() {
    var total = members.length;
    var present = 0, recorded = 0, due = 0, overdue = 0, paid = 0;
    var groups = {};

    members.forEach(function (m) {
      var s = attendanceStats(m);
      present += s.present;
      recorded += s.recorded;
      var c = clearanceStatus(m);
      if (c.key === 'due') due++;
      if (c.key === 'overdue') overdue++;
      if (isPaid(m, CUR)) paid++;
      groups[m.cds] = true;
    });

    var avg = recorded ? Math.round((present / recorded) * 100) + '%' : 'No record';
    var pending = total - paid;
    var needAction = due + overdue;

    var items = [
      {
        label: 'Corp members',
        value: String(total),
        note: 'In ' + plural(Object.keys(groups).length, 'CDS group')
      },
      {
        label: 'Average CDS attendance',
        value: avg,
        note: 'Over the last ' + ATTENDANCE_WEEKS + ' weeks'
      },
      {
        label: 'Clearances to complete',
        value: String(needAction),
        note: overdue + ' overdue, ' + due + ' due soon',
        alert: overdue > 0
      },
      {
        label: 'Allowance paid, ' + monthLabel(CUR),
        value: paid + ' of ' + total,
        note: naira(pending * ALLOWANCE_AMOUNT) + ' still pending'
      }
    ];

    el.summary.replaceChildren.apply(el.summary, items.map(function (it) {
      return h('div', { class: 'summary__item' },
        h('p', { class: 'summary__label' }, it.label),
        h('p', { class: 'summary__value' + (it.alert ? ' summary__value--alert' : '') }, it.value),
        h('p', { class: 'summary__note' }, it.note)
      );
    }));
  }

  /* ---------- Table ---------- */

  function getVisible() {
    var q = el.search.value.trim().toLowerCase();
    var group = el.filterCds.value;
    var pay = el.filterPay.value;

    return members
      .filter(function (m) {
        if (group && m.cds !== group) return false;
        if (pay === 'paid' && !isPaid(m, CUR)) return false;
        if (pay === 'pending' && isPaid(m, CUR)) return false;
        if (q) {
          var hay = (m.fullName + ' ' + fullCode(m) + ' ' + m.lga).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      })
      .sort(function (a, b) { return Number(a.codeNumber) - Number(b.codeNumber); });
  }

  function weekDot(m, value, index) {
    var state = value === 1 ? 'present' : value === 0 ? 'absent' : 'blank';
    var word = value === 1 ? 'present' : value === 0 ? 'absent' : 'not recorded';
    return h('button', {
      type: 'button',
      class: 'dot dot--' + state,
      'data-action': 'toggle-week',
      'data-week': index,
      title: 'Week ' + (index + 1) + ': ' + word,
      'aria-label': m.fullName + ', week ' + (index + 1) + ': ' + word + '. Press to change.'
    });
  }

  function allowanceChip(m, key) {
    var paid = isPaid(m, key);
    return h('button', {
      type: 'button',
      class: 'chip chip--' + (paid ? 'paid' : 'pending'),
      'data-action': 'toggle-allowance',
      'data-month': key,
      title: 'Press to mark ' + (paid ? 'pending' : 'paid')
    }, monthLabel(key) + ': ' + (paid ? 'Paid' : 'Pending'));
  }

  function renderRow(m) {
    var stats = attendanceStats(m);
    var clearance = clearanceStatus(m);
    var low = stats.pct !== null && stats.pct < LOW_ATTENDANCE;

    return h('tr', { 'data-id': m.id },
      h('td', { 'data-label': 'State code' },
        h('span', { class: 'code-tag' }, fullCode(m))),

      h('td', { 'data-label': 'Corp member', class: 'cell-name' },
        h('strong', null, m.fullName),
        h('span', { class: 'muted' }, m.gender + ', ' + m.lga)),

      h('td', { 'data-label': 'CDS group' },
        h('span', { class: 'cds-pill' }, m.cds)),

      h('td', { 'data-label': 'Attendance' },
        h('div', { class: 'attendance' },
          h('div', { class: 'dots' }, m.attendance.map(function (v, i) { return weekDot(m, v, i); })),
          h('span', { class: 'pct' + (low ? ' pct--low' : '') }, stats.pct === null ? 'No record' : stats.pct + '%'),
          low ? h('span', { class: 'badge badge--due' }, 'Low') : null)),

      h('td', { 'data-label': 'Clearance' },
        h('div', { class: 'clearance' },
          h('span', { class: 'clearance__date' }, formatDate(m.clearanceDate)),
          h('span', { class: 'badge badge--' + clearance.key }, clearance.label),
          h('button', { type: 'button', class: 'btn btn--small', 'data-action': 'toggle-cleared' },
            m.cleared ? 'Undo clearance' : 'Mark cleared'))),

      h('td', { 'data-label': 'Allowance' },
        h('div', { class: 'allowance' }, allowanceChip(m, CUR), allowanceChip(m, PREV))),

      h('td', null,
        h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'btn btn--small', 'data-action': 'edit', 'aria-label': 'Edit ' + m.fullName }, 'Edit'),
          h('button', { type: 'button', class: 'btn btn--small btn--delete', 'data-action': 'delete', 'aria-label': 'Delete ' + m.fullName }, 'Delete')))
    );
  }

  function renderEmpty(hasMembers) {
    el.empty.replaceChildren();
    if (!hasMembers) {
      el.empty.append(
        h('strong', null, 'No corp members yet'),
        h('p', null, 'Add the first corp member to start tracking CDS attendance, clearance and allowance.'),
        h('button', { type: 'button', class: 'btn btn--primary', 'data-empty': 'add' }, 'Add corp member')
      );
    } else {
      el.empty.append(
        h('strong', null, 'No corp members match these filters'),
        h('p', null, 'Change the search or filters to see more of the list.'),
        h('button', { type: 'button', class: 'btn', 'data-empty': 'clear' }, 'Clear filters')
      );
    }
  }

  function render() {
    renderSummary();

    var list = getVisible();
    el.tbody.replaceChildren.apply(el.tbody, list.map(renderRow));
    el.count.textContent = 'Showing ' + list.length + ' of ' + plural(members.length, 'corp member');

    if (list.length === 0) {
      renderEmpty(members.length > 0);
      el.empty.hidden = false;
    } else {
      el.empty.hidden = true;
    }
  }

  function rerenderKeepingFocus(btn) {
    var tr = btn.closest('tr');
    var query = 'tr[data-id="' + CSS.escape(tr.dataset.id) + '"] button[data-action="' + btn.dataset.action + '"]';
    if (btn.dataset.week !== undefined) query += '[data-week="' + btn.dataset.week + '"]';
    if (btn.dataset.month !== undefined) query += '[data-month="' + btn.dataset.month + '"]';
    render();
    var next = el.tbody.querySelector(query);
    if (next) next.focus();
  }

  /* ---------- Table actions ---------- */

  el.tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var tr = btn.closest('tr');
    var m = members.find(function (x) { return x.id === tr.dataset.id; });
    if (!m) return;

    switch (btn.dataset.action) {
      case 'edit':
        openForm(m);
        return;

      case 'delete':
        openConfirm({
          title: 'Delete ' + m.fullName + '?',
          message: 'This removes ' + fullCode(m) + ' and all of their attendance, clearance and allowance records. You cannot undo this.',
          confirmLabel: 'Delete member',
          cancelLabel: 'Keep member',
          onConfirm: function () {
            members = members.filter(function (x) { return x.id !== m.id; });
            save();
            render();
            showToast('Deleted ' + m.fullName + ' (' + fullCode(m) + ')');
          }
        });
        return;

      case 'toggle-week':
        var i = Number(btn.dataset.week);
        var v = m.attendance[i];
        m.attendance[i] = v === null ? 1 : v === 1 ? 0 : null;
        break;

      case 'toggle-cleared':
        m.cleared = !m.cleared;
        break;

      case 'toggle-allowance':
        m.allowance = m.allowance || {};
        m.allowance[btn.dataset.month] = !m.allowance[btn.dataset.month];
        break;

      default:
        return;
    }

    save();
    rerenderKeepingFocus(btn);
  });

  el.empty.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-empty]');
    if (!btn) return;
    if (btn.dataset.empty === 'add') {
      openForm(null);
    } else {
      el.search.value = '';
      el.filterCds.value = '';
      el.filterPay.value = '';
      render();
      el.search.focus();
    }
  });

  /* ---------- Filters ---------- */

  el.search.addEventListener('input', render);
  el.filterCds.addEventListener('change', render);
  el.filterPay.addEventListener('change', render);

  /* ---------- Add / edit form ---------- */

  var FIELD_NAMES = ['fullName', 'gender', 'codeNumber', 'lga', 'cds', 'clearanceDate'];

  function fillSelect(select, values) {
    values.forEach(function (v) { select.append(h('option', { value: v }, v)); });
  }

  function clearErrors() {
    FIELD_NAMES.forEach(function (name) {
      var err = $(name + 'Error');
      if (err) err.textContent = '';
      var input = $(name);
      if (input) input.removeAttribute('aria-invalid');
    });
  }

  function generateCode() {
    var used = {};
    members.forEach(function (m) {
      if (m.id !== editingId) used[m.codeNumber] = true;
    });
    for (var tries = 0; tries < 500; tries++) {
      var n = String(1000 + Math.floor(Math.random() * 9000));
      if (!used[n]) return n;
    }
    for (var i = 1; i <= 9999; i++) {
      var p = String(i).padStart(4, '0');
      if (!used[p]) return p;
    }
    return '';
  }

  function openForm(m) {
    editingId = m ? m.id : null;
    el.form.reset();
    clearErrors();

    el.formTitle.textContent = m ? 'Edit corp member' : 'Add corp member';
    el.submitForm.textContent = m ? 'Save changes' : 'Add member';

    if (m) {
      el.form.elements.fullName.value = m.fullName;
      var radio = el.form.querySelector('input[name="gender"][value="' + m.gender + '"]');
      if (radio) radio.checked = true;
      el.codeNumber.value = m.codeNumber;
      el.lga.value = m.lga;
      el.cds.value = m.cds;
      el.form.elements.clearanceDate.value = m.clearanceDate;
      el.form.elements.cleared.checked = !!m.cleared;
      el.form.elements.paidCur.checked = isPaid(m, CUR);
      el.form.elements.paidPrev.checked = isPaid(m, PREV);
    } else {
      el.codeNumber.value = generateCode();
      el.form.elements.clearanceDate.value = endOfMonthIso();
    }

    el.formDialog.showModal();
    el.form.elements.fullName.focus();
  }

  function readForm() {
    var f = new FormData(el.form);
    return {
      fullName: String(f.get('fullName') || '').trim().replace(/\s+/g, ' '),
      gender: String(f.get('gender') || ''),
      codeNumber: String(f.get('codeNumber') || '').trim(),
      lga: String(f.get('lga') || ''),
      cds: String(f.get('cds') || ''),
      clearanceDate: String(f.get('clearanceDate') || ''),
      cleared: el.form.elements.cleared.checked,
      paidCur: el.form.elements.paidCur.checked,
      paidPrev: el.form.elements.paidPrev.checked
    };
  }

  function validate(d) {
    var errors = {};

    if (!/^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s'\u2019.\-]+$/.test(d.fullName) || d.fullName.split(' ').length < 2) {
      errors.fullName = 'Enter the first name and surname, using letters only.';
    }

    if (!d.gender) errors.gender = 'Choose a gender.';

    if (!/^\d{1,4}$/.test(d.codeNumber) || Number(d.codeNumber) === 0) {
      errors.codeNumber = 'Enter a number from 1 to 9999.';
    } else {
      var padded = d.codeNumber.padStart(4, '0');
      var clash = members.find(function (m) { return m.codeNumber === padded && m.id !== editingId; });
      if (clash) errors.codeNumber = STATE_CODE_PREFIX + padded + ' already belongs to ' + clash.fullName + '. Use a different number.';
    }

    if (!d.lga) errors.lga = 'Select the LGA of posting.';
    if (!d.cds) errors.cds = 'Select a CDS group.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.clearanceDate)) errors.clearanceDate = 'Choose a clearance date.';

    return errors;
  }

  function showErrors(errors) {
    FIELD_NAMES.forEach(function (name) {
      var err = $(name + 'Error');
      var input = $(name);
      if (err) err.textContent = errors[name] || '';
      if (input) {
        if (errors[name]) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    });
  }

  function focusField(name) {
    var target = name === 'gender' ? el.form.querySelector('input[name="gender"]') : $(name);
    if (target) target.focus();
  }

  el.codeNumber.addEventListener('input', function () {
    el.codeNumber.value = el.codeNumber.value.replace(/\D/g, '').slice(0, 4);
  });

  el.genCode.addEventListener('click', function () {
    el.codeNumber.value = generateCode();
    el.codeNumber.focus();
  });

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();

    var d = readForm();
    var errors = validate(d);
    showErrors(errors);

    var firstBad = FIELD_NAMES.find(function (name) { return errors[name]; });
    if (firstBad) {
      focusField(firstBad);
      return;
    }

    var code = d.codeNumber.padStart(4, '0');
    var message;

    if (editingId) {
      var m = members.find(function (x) { return x.id === editingId; });
      m.fullName = d.fullName;
      m.gender = d.gender;
      m.codeNumber = code;
      m.lga = d.lga;
      m.cds = d.cds;
      m.clearanceDate = d.clearanceDate;
      m.cleared = d.cleared;
      m.allowance = m.allowance || {};
      m.allowance[CUR] = d.paidCur;
      m.allowance[PREV] = d.paidPrev;
      message = 'Saved changes to ' + m.fullName + ' (' + fullCode(m) + ')';
    } else {
      var allowance = {};
      allowance[CUR] = d.paidCur;
      allowance[PREV] = d.paidPrev;
      var created = {
        id: newId(),
        fullName: d.fullName,
        gender: d.gender,
        codeNumber: code,
        lga: d.lga,
        cds: d.cds,
        attendance: emptyAttendance(),
        clearanceDate: d.clearanceDate,
        cleared: d.cleared,
        allowance: allowance
      };
      members.push(created);
      message = 'Added ' + created.fullName + ' (' + fullCode(created) + ')';
    }

    save();
    el.formDialog.close();
    render();
    showToast(message);
  });

  el.cancelForm.addEventListener('click', function () { el.formDialog.close(); });

  /* ---------- Confirm dialog ---------- */

  function openConfirm(opts) {
    confirmAction = opts.onConfirm;
    el.confirmTitle.textContent = opts.title;
    el.confirmMessage.textContent = opts.message;
    el.confirmOk.textContent = opts.confirmLabel;
    el.confirmCancel.textContent = opts.cancelLabel;
    el.confirmDialog.showModal();
    el.confirmCancel.focus();
  }

  el.confirmOk.addEventListener('click', function () {
    var action = confirmAction;
    confirmAction = null;
    el.confirmDialog.close();
    if (action) action();
  });

  el.confirmCancel.addEventListener('click', function () {
    confirmAction = null;
    el.confirmDialog.close();
  });

  /* ---------- Masthead buttons ---------- */

  el.addBtn.addEventListener('click', function () { openForm(null); });

  el.resetBtn.addEventListener('click', function () {
    openConfirm({
      title: 'Reset to sample data?',
      message: 'This replaces every corp member in this browser with the 12 sample records. Any members you added or edited will be lost.',
      confirmLabel: 'Reset sample data',
      cancelLabel: 'Keep my data',
      onConfirm: function () {
        members = buildSampleMembers();
        save();
        render();
        showToast('Sample data restored');
      }
    });
  });

  /* ---------- Toast ---------- */

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 4000);
  }

  /* ---------- Start ---------- */

  function init() {
    fillSelect(el.filterCds, CDS_GROUPS);
    fillSelect(el.cds, CDS_GROUPS);
    fillSelect(el.lga, RIVERS_LGAS);
    el.codePrefix.textContent = STATE_CODE_PREFIX;
    el.filterPayLabel.textContent = 'Allowance, ' + monthLabel(CUR);
    el.paidCurLabel.textContent = 'Allowance paid for ' + monthLabel(CUR);
    el.paidPrevLabel.textContent = 'Allowance paid for ' + monthLabel(PREV);
    render();
  }

  init();
})();
