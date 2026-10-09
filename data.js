/* ==========================================================
   data.js
   Settings, lists and sample data for the CDS tracker.
   Edit the values here; app.js reads them as globals.
   ========================================================== */

/* State code = prefix + a number from 0001 to 9999.
   Only the number changes between corp members. */
var STATE_CODE_PREFIX = 'RV/26B/';

/* Monthly allowance per corp member, in naira. Change it here if the amount changes. */
var ALLOWANCE_AMOUNT = 77000;

/* Number of recent weeks shown in the attendance column. */
var ATTENDANCE_WEEKS = 6;

/* Attendance below this percentage is flagged "Low". */
var LOW_ATTENDANCE = 70;

/* A clearance is flagged "Due" when it falls within this many days. */
var CLEARANCE_WARNING_DAYS = 7;

/* CDS groups. Add the rest of the groups to this list. */
var CDS_GROUPS = [
  'ICT',
  'NEMA',
  'Education',
  'Road Safety',
  'SDG'
];

/* The 23 Local Government Areas of Rivers State. */
var RIVERS_LGAS = [
  'Abua/Odual',
  'Ahoada East',
  'Ahoada West',
  'Akuku-Toru',
  'Andoni',
  'Asari-Toru',
  'Bonny',
  'Degema',
  'Eleme',
  'Emohua',
  'Etche',
  'Gokana',
  'Ikwerre',
  'Khana',
  'Obio/Akpor',
  'Ogba/Egbema/Ndoni',
  'Ogu/Bolo',
  'Okrika',
  'Omuma',
  'Opobo/Nkoro',
  'Oyigbo',
  'Port Harcourt',
  'Tai'
];

/* ---------- Date helpers (local time, no timezone shifts) ---------- */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/* "YYYY-MM-DD" for today plus/minus a number of days. */
function isoDate(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/* "YYYY-MM" for this month plus/minus a number of months. */
function monthKey(offsetMonths) {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + (offsetMonths || 0));
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

/* ---------- Sample corp members ----------
   Dates and months are relative to today, so the clearance flags
   (cleared, due, overdue, upcoming) always show a realistic mix.
   attendance: 1 = present, 0 = absent, null = not recorded (oldest week first). */

function buildSampleMembers() {
  var cur = monthKey(0);
  var prev = monthKey(-1);

  function member(id, fullName, gender, codeNumber, lga, cds, attendance, clearanceOffset, cleared, paidNow, paidPrev) {
    var allowance = {};
    allowance[cur] = paidNow;
    allowance[prev] = paidPrev;
    return {
      id: id,
      fullName: fullName,
      gender: gender,
      codeNumber: codeNumber,
      lga: lga,
      cds: cds,
      attendance: attendance,
      clearanceDate: isoDate(clearanceOffset),
      cleared: cleared,
      allowance: allowance
    };
  }

  return [
    member('m1',  'Ngozi Amadi',         'Female', '1345', 'Obio/Akpor',   'ICT',         [1, 1, 1, 1, 1, 1],  -2, true,  true,  true),
    member('m2',  'Tamunoemi Briggs',    'Male',   '2208', 'Port Harcourt','NEMA',        [1, 1, 0, 1, 1, 1],   3, false, false, true),
    member('m3',  'Blessing Nwachukwu',  'Female', '0586', 'Ikwerre',      'Education',   [1, 0, 1, 1, 0, 1],  -2, true,  true,  true),
    member('m4',  'Emeka Okafor',        'Male',   '4417', 'Eleme',        'Road Safety', [0, 1, 1, 0, 1, 0],  -4, false, false, true),
    member('m5',  'Barinem Saro',        'Male',   '3092', 'Khana',        'SDG',         [1, 1, 1, 1, 0, 1],  12, false, true,  true),
    member('m6',  'Aisha Bello',         'Female', '1873', 'Oyigbo',       'ICT',         [1, 1, 1, 0, 1, 1],  -2, true,  true,  true),
    member('m7',  'Oluwaseun Adebayo',   'Male',   '2760', 'Obio/Akpor',   'Education',   [0, 0, 1, 0, 1, 0],  -6, false, false, false),
    member('m8',  'Preye Ebiye',         'Female', '0941', 'Bonny',        'NEMA',        [1, 1, 1, 1, 1, 0],   5, false, false, true),
    member('m9',  'Chidinma Eze',        'Female', '3655', 'Emohua',       'SDG',         [1, 0, 1, 1, 1, 1],  12, false, true,  true),
    member('m10', 'Ibrahim Musa',        'Male',   '4128', 'Port Harcourt','Road Safety', [1, 1, 0, 0, 1, 1],  -2, true,  false, false),
    member('m11', 'Ifeoma Nnadi',        'Female', '1502', 'Etche',        'Education',   [1, 1, 1, 1, 1, 1],   0, false, true,  true),
    member('m12', 'Dagogo Wokoma',       'Male',   '2934', 'Degema',       'ICT',         [1, 0, 1, 0, 1, 1],  12, false, false, true)
  ];
}
