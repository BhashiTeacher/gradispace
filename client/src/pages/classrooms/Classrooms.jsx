import { useState, useEffect } from 'react';
import {
  UsersIcon, PlusIcon, TrashIcon, PencilIcon, XMarkIcon,
  ArrowLeftIcon, LinkIcon, CheckIcon, ClipboardDocumentIcon,
  DocumentTextIcon, UserGroupIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api';
import Spinner from '../../components/UI/Spinner';
import ProGate from '../../components/UI/ProGate';

// ── Helpers ───────────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
      {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
    </button>
  );
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
function GroupModal({ mode, initial, onSave, onClose, saving }) {
  const [name, setName]         = useState(initial?.name        || '');
  const [subject, setSubject]   = useState(initial?.subject     || '');
  const [grade, setGrade]       = useState(initial?.grade_level || '');
  const [desc, setDesc]         = useState(initial?.description || '');
  const [error, setError]       = useState('');

  function handleSubmit() {
    if (!name.trim()) { setError('Classroom name is required.'); return; }
    onSave({ name: name.trim(), subject: subject.trim() || null, gradeLevel: grade.trim() || null, description: desc.trim() || null });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">{mode === 'create' ? 'New Classroom' : 'Edit Classroom'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Name <span className="text-red-400">*</span></label>
            <input className={`input ${error ? 'border-red-400' : ''}`} value={name} onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Grade 10 Science — Term 2" />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Science" />
            </div>
            <div>
              <label className="label">Grade Level</label>
              <input className="input" value={grade} onChange={e => setGrade(e.target.value)} placeholder="e.g. Grade 10" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Optional description…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary btn-sm">
            {saving && <Spinner className="w-4 h-4 mr-1.5" />}
            {mode === 'create' ? 'Create Classroom' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Exams modal ───────────────────────────────────────────────────────────
function AddExamsModal({ groupExamIds, onAdd, onClose, saving }) {
  const { toast } = useToast();
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel]         = useState(new Set());

  useEffect(() => {
    api.get('/exams?limit=100')
      .then(({ exams: es }) => setExams(es.filter(e => !groupExamIds.has(e.id))))
      .catch(() => toast('Failed to load exams.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="font-semibold text-slate-900">Add Exams to Classroom</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-primary-500" /></div>
          ) : exams.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No other exams to add.</p>
          ) : (
            <div className="space-y-2">
              {exams.map(e => (
                <label key={e.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-primary-200 cursor-pointer">
                  <input type="checkbox" className="rounded text-primary-600"
                    checked={sel.has(e.id)}
                    onChange={() => {
                      const next = new Set(sel);
                      next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                      setSel(next);
                    }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                    <p className="text-xs text-slate-400">{e.subject || ''}{e.grade_level ? ` · ${e.grade_level}` : ''}</p>
                  </div>
                  {e.published && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                      Live
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={() => onAdd([...sel])} disabled={saving || sel.size === 0} className="btn-primary btn-sm">
            {saving && <Spinner className="w-4 h-4 mr-1.5" />}
            Add {sel.size > 0 ? sel.size : ''} Exam{sel.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Students modal ────────────────────────────────────────────────────────
function AddStudentsModal({ onAdd, onClose, saving }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function parseStudents(raw) {
    return raw.split('\n')
      .map(line => line.trim()).filter(Boolean)
      .map(line => {
        const [email, name] = line.split(',').map(s => s.trim());
        return { email: email?.toLowerCase(), name: name || null };
      })
      .filter(s => s.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email));
  }

  function handleAdd() {
    const students = parseStudents(text);
    if (!students.length) { setError('Enter at least one valid email address.'); return; }
    onAdd(students);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Add Students</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Student emails</label>
            <textarea className={`input resize-none font-mono text-xs ${error ? 'border-red-400' : ''}`}
              rows={8} value={text} onChange={e => { setText(e.target.value); setError(''); }}
              placeholder={'student@example.com\njohn@school.edu, John Smith\njane@school.edu'} />
            {error
              ? <p className="text-xs text-red-500 mt-1">{error}</p>
              : <p className="text-xs text-slate-400 mt-1">One email per line. Optionally add a name after a comma.</p>}
          </div>
          {text && (
            <p className="text-xs text-slate-500">
              {parseStudents(text).length} valid student{parseStudents(text).length !== 1 ? 's' : ''} detected
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={handleAdd} disabled={saving} className="btn-primary btn-sm">
            {saving && <Spinner className="w-4 h-4 mr-1.5" />}
            Add Students
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Classrooms() {
  const { isPro } = useAuth();
  const { toast } = useToast();
  const navigate  = useNavigate();

  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);   // group detail
  const [detailTab, setDetailTab] = useState('exams');
  const [groupExams, setGroupExams]     = useState([]);
  const [groupStudents, setGroupStudents] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modal, setModal]         = useState(null); // 'create' | 'edit' | 'addExams' | 'addStudents'
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);

  useEffect(() => { if (isPro) loadGroups(); }, [isPro]); // eslint-disable-line

  function loadGroups() {
    setLoading(true);
    api.get('/groups')
      .then(({ groups: gs }) => setGroups(gs))
      .catch(() => toast('Failed to load classrooms.', 'error'))
      .finally(() => setLoading(false));
  }

  function openGroup(g) {
    setSelected(g);
    setDetailTab('exams');
    setDetailLoading(true);
    Promise.all([
      api.get(`/groups/${g.id}/exams`),
      api.get(`/groups/${g.id}/students`),
    ]).then(([{ exams }, { students }]) => {
      setGroupExams(exams);
      setGroupStudents(students);
    }).catch(() => toast('Failed to load classroom details.', 'error'))
      .finally(() => setDetailLoading(false));
  }

  function closeDetail() { setSelected(null); setGroupExams([]); setGroupStudents([]); }

  // Create
  async function handleCreate(payload) {
    setSaving(true);
    try {
      const { group } = await api.post('/groups', payload);
      toast('Classroom created!', 'success');
      setModal(null);
      setGroups(prev => [{ ...group, exam_count: 0, student_count: 0 }, ...prev]);
    } catch (err) { toast(err.message || 'Failed to create.', 'error'); }
    finally { setSaving(false); }
  }

  // Edit
  async function handleEdit(payload) {
    setSaving(true);
    try {
      const { group } = await api.put(`/groups/${selected.id}`, payload);
      const updated = { ...selected, ...group };
      setSelected(updated);
      setGroups(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
      toast('Classroom updated.', 'success');
      setModal(null);
    } catch (err) { toast(err.message || 'Failed to update.', 'error'); }
    finally { setSaving(false); }
  }

  // Delete
  async function handleDelete() {
    if (!window.confirm(`Delete "${selected.name}"? This will remove all associated data.`)) return;
    setDeleting(true);
    try {
      await api.del(`/groups/${selected.id}`);
      toast('Classroom deleted.', 'success');
      setGroups(prev => prev.filter(g => g.id !== selected.id));
      closeDetail();
    } catch (err) { toast(err.message || 'Failed to delete.', 'error'); }
    finally { setDeleting(false); }
  }

  // Add exams
  async function handleAddExams(examIds) {
    setSaving(true);
    try {
      const { added } = await api.post(`/groups/${selected.id}/exams`, { examIds });
      toast(`${added} exam${added !== 1 ? 's' : ''} added.`, 'success');
      setModal(null);
      const { exams } = await api.get(`/groups/${selected.id}/exams`);
      setGroupExams(exams);
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, exam_count: exams.length } : g));
    } catch (err) { toast(err.message || 'Failed to add exams.', 'error'); }
    finally { setSaving(false); }
  }

  // Remove exam
  async function removeExam(examId) {
    try {
      await api.del(`/groups/${selected.id}/exams/${examId}`);
      const updated = groupExams.filter(e => e.id !== examId);
      setGroupExams(updated);
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, exam_count: updated.length } : g));
    } catch (err) { toast(err.message || 'Failed to remove exam.', 'error'); }
  }

  // Add students
  async function handleAddStudents(students) {
    setSaving(true);
    try {
      const { added, skipped } = await api.post(`/groups/${selected.id}/students`, { students });
      const msg = skipped ? `${added} added, ${skipped} already exist.` : `${added} student${added !== 1 ? 's' : ''} added.`;
      toast(msg, 'success');
      setModal(null);
      const { students: fresh } = await api.get(`/groups/${selected.id}/students`);
      setGroupStudents(fresh);
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, student_count: fresh.length } : g));
    } catch (err) { toast(err.message || 'Failed to add students.', 'error'); }
    finally { setSaving(false); }
  }

  // Remove student
  async function removeStudent(email) {
    try {
      await api.del(`/groups/${selected.id}/students/${encodeURIComponent(email)}`);
      const updated = groupStudents.filter(s => s.email !== email);
      setGroupStudents(updated);
      setGroups(prev => prev.map(g => g.id === selected.id ? { ...g, student_count: updated.length } : g));
    } catch (err) { toast(err.message || 'Failed to remove student.', 'error'); }
  }

  // ── Pro gate ──────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div>
        <h1 className="page-title mb-6">Classrooms</h1>
        <ProGate feature="Classrooms">
          <div className="card p-8 text-center">
            <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Classrooms are a Pro feature</p>
            <p className="text-sm text-slate-500 mt-1">Group exams, manage student rosters, and share a single link for multiple exams.</p>
          </div>
        </ProGate>
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    const groupLink = selected.group_link || `${window.location.origin}/g/${selected.access_token}`;
    const groupExamIds = new Set(groupExams.map(e => e.id));

    return (
      <div>
        {/* Back + header */}
        <button onClick={closeDetail}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Classrooms
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">{selected.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              {selected.subject     && <span>{selected.subject}</span>}
              {selected.grade_level && <span>· {selected.grade_level}</span>}
              <span>· {selected.exam_count || groupExams.length} exam{(selected.exam_count || groupExams.length) !== 1 ? 's' : ''}</span>
              <span>· {selected.student_count || groupStudents.length} student{(selected.student_count || groupStudents.length) !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={() => setModal('edit')} className="btn-secondary btn-sm flex-shrink-0">
            <PencilIcon className="w-4 h-4 mr-1.5" /> Edit
          </button>
        </div>

        {/* Group link */}
        <div className="card p-4 mb-5 flex items-center gap-3">
          <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-600 flex-1 break-all select-all">{groupLink}</span>
          <CopyButton text={groupLink} />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-5">
          {[
            { key: 'exams',    label: 'Exams',    icon: DocumentTextIcon },
            { key: 'students', label: 'Students', icon: UserGroupIcon },
            { key: 'settings', label: 'Settings', icon: Cog6ToothIcon },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setDetailTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${detailTab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-primary-500" /></div>
        ) : (
          <>
            {/* Exams tab */}
            {detailTab === 'exams' && (
              <div>
                <div className="flex justify-end mb-3">
                  <button onClick={() => setModal('addExams')} className="btn-primary btn-sm">
                    <PlusIcon className="w-4 h-4 mr-1.5" /> Add Exams
                  </button>
                </div>
                {groupExams.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm">No exams in this classroom yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupExams.map(e => (
                      <div key={e.id} className="card p-4 flex items-center gap-3 group hover:border-primary-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {e.question_count} question{e.question_count !== 1 ? 's' : ''}
                            {e.subject ? ` · ${e.subject}` : ''}
                            {e.grade_level ? ` · ${e.grade_level}` : ''}
                          </p>
                        </div>
                        {e.published
                          ? <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Live</span>
                          : <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Draft</span>}
                        <button onClick={() => navigate(`/exams/${e.id}`)}
                          className="btn-ghost btn-sm opacity-0 group-hover:opacity-100">Edit</button>
                        <button onClick={() => removeExam(e.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Students tab */}
            {detailTab === 'students' && (
              <div>
                <div className="flex justify-end mb-3">
                  <button onClick={() => setModal('addStudents')} className="btn-primary btn-sm">
                    <PlusIcon className="w-4 h-4 mr-1.5" /> Add Students
                  </button>
                </div>
                {groupStudents.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <UserGroupIcon className="w-12 h-12 mx-auto mb-2 text-slate-200" />
                    <p className="text-sm">No students enrolled yet.</p>
                    <p className="text-xs mt-1">Add student emails so they can access closed exams.</p>
                  </div>
                ) : (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <span className="flex-1">Email</span>
                      <span className="w-40 hidden sm:block">Name</span>
                      <span className="w-8" />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {groupStudents.map(s => (
                        <div key={s.email} className="px-4 py-3 flex items-center group hover:bg-slate-50">
                          <span className="flex-1 text-sm text-slate-700 truncate">{s.email}</span>
                          <span className="w-40 text-sm text-slate-400 truncate hidden sm:block">{s.name || '—'}</span>
                          <button onClick={() => removeStudent(s.email)}
                            className="w-8 flex justify-center p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings tab */}
            {detailTab === 'settings' && (
              <div className="max-w-md space-y-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Classroom Details</h3>
                  <dl className="space-y-2 text-sm">
                    {[
                      { label: 'Name',        value: selected.name },
                      { label: 'Subject',     value: selected.subject     || '—' },
                      { label: 'Grade Level', value: selected.grade_level || '—' },
                      { label: 'Description', value: selected.description || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-3">
                        <dt className="w-28 text-slate-400 flex-shrink-0">{label}</dt>
                        <dd className="text-slate-700">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <button onClick={() => setModal('edit')} className="btn-secondary btn-sm mt-4">
                    <PencilIcon className="w-4 h-4 mr-1.5" /> Edit Details
                  </button>
                </div>

                <div className="card p-5 border-red-200">
                  <h3 className="text-sm font-semibold text-red-700 mb-1">Danger Zone</h3>
                  <p className="text-xs text-slate-500 mb-3">Deleting a classroom removes it permanently including all exam assignments and student rosters.</p>
                  <button onClick={handleDelete} disabled={deleting} className="btn-danger btn-sm">
                    {deleting ? <Spinner className="w-4 h-4 mr-1.5" /> : <TrashIcon className="w-4 h-4 mr-1.5" />}
                    Delete Classroom
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modals for detail view */}
        {modal === 'edit' && (
          <GroupModal mode="edit" initial={selected} onSave={handleEdit} onClose={() => setModal(null)} saving={saving} />
        )}
        {modal === 'addExams' && (
          <AddExamsModal groupExamIds={groupExamIds} onAdd={handleAddExams} onClose={() => setModal(null)} saving={saving} />
        )}
        {modal === 'addStudents' && (
          <AddStudentsModal onAdd={handleAddStudents} onClose={() => setModal(null)} saving={saving} />
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Classrooms</h1>
          <p className="text-sm text-slate-500 mt-0.5">Group exams and manage student rosters</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">
          <PlusIcon className="w-4 h-4 mr-1.5" /> New Classroom
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <UsersIcon className="w-14 h-14 mx-auto mb-3 text-slate-200" />
          <p className="text-base font-medium text-slate-500">No classrooms yet</p>
          <p className="text-sm mt-1 mb-5">Create a classroom to group exams and share one link with a class.</p>
          <button onClick={() => setModal('create')} className="btn-primary">
            <PlusIcon className="w-4 h-4 mr-1.5" /> Create your first classroom
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => (
            <button key={g.id} onClick={() => openGroup(g)}
              className="card p-5 text-left hover:border-primary-300 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 truncate mb-1">{g.name}</h3>
              {(g.subject || g.grade_level) && (
                <p className="text-xs text-slate-400 mb-2 truncate">
                  {[g.subject, g.grade_level].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <DocumentTextIcon className="w-3.5 h-3.5" /> {g.exam_count} exam{g.exam_count !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <UserGroupIcon className="w-3.5 h-3.5" /> {g.student_count} student{g.student_count !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {modal === 'create' && (
        <GroupModal mode="create" initial={null} onSave={handleCreate} onClose={() => setModal(null)} saving={saving} />
      )}
    </div>
  );
}
