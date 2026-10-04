import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getClassAdvisors,
  assignClassAdvisor,
  deactivateClassAdvisor,
} from '../../services/hodAllocationService';
import { getAcademicContexts, createAcademicContext } from '../../services/academicContextService';
import { getFacultyList } from '../../services/facultyService';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import Select from '../../components/common/Select';

// Authoritative target class cohorts (II–IV Year, Sections A–D)
const TARGET_CLASSES = [
  { year: 'II Year', section: 'A' },
  { year: 'II Year', section: 'B' },
  { year: 'II Year', section: 'C' },
  { year: 'II Year', section: 'D' },
  { year: 'III Year', section: 'A' },
  { year: 'III Year', section: 'B' },
  { year: 'III Year', section: 'C' },
  { year: 'III Year', section: 'D' },
  { year: 'IV Year', section: 'A' },
  { year: 'IV Year', section: 'B' },
  { year: 'IV Year', section: 'C' },
  { year: 'IV Year', section: 'D' },
];

export default function ClassAdvisorPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advisors, setAdvisors] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [facultyList, setFacultyList] = useState([]);

  // Filter state
  const [selectedYearFilter, setSelectedYearFilter] = useState('ALL');

  // Assignment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [activeTargetCohort, setActiveTargetCohort] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [formValidation, setFormValidation] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [advRes, ctxRes, facRes] = await Promise.allSettled([
        getClassAdvisors(),
        getAcademicContexts(),
        getFacultyList({ limit: 100 }),
      ]);

      if (advRes.status === 'fulfilled' && advRes.value) {
        const list = Array.isArray(advRes.value) ? advRes.value : advRes.value.data || [];
        setAdvisors(list);
      }
      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const list = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(list);
      }
      if (facRes.status === 'fulfilled' && facRes.value) {
        const list = facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []);
        setFacultyList(list);
        if (list.length > 0 && !selectedFacultyId) setSelectedFacultyId(list[0].facultyId);
      }
    } catch (err) {
      console.error('[ClassAdvisorPage] Failed to fetch data:', err);
      setError(err.message || 'Unable to retrieve Class Advisor roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAssignModal = (target) => {
    setActiveTargetCohort(target);
    setSelectedFacultyId(facultyList[0]?.facultyId || '');
    setFormValidation('');
    setIsModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      setFormValidation('Please select a faculty member.');
      return;
    }

    try {
      setAssigning(true);
      setFormValidation('');

      // Find or create academic context for this target class
      let ctx = contexts.find(
        (c) =>
          c.year === activeTargetCohort.year &&
          c.section === activeTargetCohort.section &&
          c.department === 'CSE'
      );

      if (!ctx) {
        // Get current academic context from existing data
        const currentYear = contexts[0]?.academicYear || 'Current';
        const currentSemester = contexts[0]?.semester || '';

        // Create context on the fly if missing in DB
        const createdCtx = await createAcademicContext({
          academicYear: currentYear,
          semester: currentSemester,
          department: 'CSE',
          year: activeTargetCohort.year,
          section: activeTargetCohort.section,
          program: 'UG',
          status: 'ACTIVE',
        });
        ctx = createdCtx?.data || createdCtx;
      }

      const contextId = ctx?._id || ctx?.id;
      if (!contextId) {
        throw new Error('Unable to resolve academic context identifier.');
      }

      await assignClassAdvisor({
        academicContextId: contextId,
        facultyId: selectedFacultyId,
      });

      showToast(`Class Advisor appointed for ${activeTargetCohort.year} Section ${activeTargetCohort.section}.`, 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[ClassAdvisorPage] Assignment failed:', err);
      setFormValidation(err.message || 'Failed to appoint Class Advisor.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeactivate = async (id, facultyLabel) => {
    if (!window.confirm(`Deactivate Class Advisor appointment for ${facultyLabel}?`)) return;
    try {
      await deactivateClassAdvisor(id);
      showToast('Class Advisor assignment deactivated.', 'info');
      await loadData();
    } catch (err) {
      console.error('[ClassAdvisorPage] Deactivation failed:', err);
      showToast(err.message || 'Failed to deactivate assignment.', 'error');
    }
  };

  const filteredTargets = TARGET_CLASSES.filter((t) => {
    if (selectedYearFilter === 'ALL') return true;
    return t.year === selectedYearFilter;
  });

  return (
    <div>
      <PageHeader
        title="Class Advisor Management"
        description="Statutory HOD authority for appointing and managing faculty Class Advisors across all 12 undergraduate CSE class cohorts."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Class Advisor' },
        ]}
        badge={<Badge variant="primary">HOD AUTHORITY</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-outline)' }}>Filter Year:</span>
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '0.8125rem', borderRadius: 'var(--radius-md)' }}
            >
              <option value="ALL">All Years (II, III, IV)</option>
              <option value="II Year">II Year</option>
              <option value="III Year">III Year</option>
              <option value="IV Year">IV Year</option>
            </select>
            <Button variant="outline" size="sm" icon="🔄" onClick={loadData}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Target Academic Context Header */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
              Academic Target Context
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
              {(() => {
                const yrs = [...new Set(contexts.map(c => c.academicYear).filter(Boolean))];
                const sems = [...new Set(contexts.map(c => c.semester).filter(Boolean))];
                if (yrs.length === 0) return 'Department of Computer Science & Engineering';
                return `${yrs.join(', ')}${sems.length ? ' — ' + sems.join(', ') : ''} — Department of Computer Science & Engineering`;
              })()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge variant="secondary">Total Cohorts: 12 Classes</Badge>
            <Badge variant="primary">Target: II, III, IV (Sec A, B, C, D)</Badge>
          </div>
        </div>
      </Card>

      {/* Class Advisor Grid for all 12 Target Classes */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spinner size="lg" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading Class Advisor roster...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : (
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Class Cohort</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Semester & Year</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Class Advisor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Advisor Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>HOD Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.map((target) => {
                  // Find matching context
                  const ctx = contexts.find(
                    (c) => c.year === target.year && c.section === target.section && c.department === 'CSE'
                  );
                  const ctxId = ctx?._id || ctx?.id;

                  // Find active advisors for this context
                  const activeAdvisors = advisors.filter(
                    (a) =>
                      a.status === 'ACTIVE' &&
                      ((ctxId && String(a.academicContextId?._id || a.academicContextId) === String(ctxId)) ||
                        (a.academicContextId?.year === target.year && a.academicContextId?.section === target.section))
                  );

                  const isConflict = activeAdvisors.length > 1;
                  const primaryAdvisor = activeAdvisors[0];
                  const facultyMatch = primaryAdvisor
                    ? facultyList.find((f) => f.facultyId === primaryAdvisor.facultyId)
                    : null;

                  return (
                    <tr
                      key={`${target.year}-${target.section}`}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        backgroundColor: isConflict
                          ? 'rgba(239, 68, 68, 0.04)'
                          : !primaryAdvisor
                          ? 'rgba(245, 158, 11, 0.02)'
                          : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {target.year} — Section &apos;{target.section}&apos;
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          const y = ctx?.academicYear || '—';
                          const s = ctx?.semester || '—';
                          return `${y} (${s})`;
                        })()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isConflict ? (
                          <div>
                            <div style={{ color: 'var(--color-error)', fontWeight: 700, fontSize: '0.8125rem' }}>
                              ⚠️ [CONFLICT] Multiple Active Advisors Found:
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-on-surface-variant)' }}>
                              {activeAdvisors.map((adv) => adv.facultyId).join(', ')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: '2px' }}>
                              HOD final assignment required to resolve.
                            </div>
                          </div>
                        ) : primaryAdvisor ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>
                              {facultyMatch?.facultyName || primaryAdvisor.facultyId}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)' }}>
                              ID: {primaryAdvisor.facultyId} {facultyMatch?.designation ? `• ${facultyMatch.designation}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.8125rem' }}>
                            [REQUIRES HOD APPOINTMENT]
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isConflict ? (
                          <Badge variant="danger">CONFLICT</Badge>
                        ) : primaryAdvisor ? (
                          <Badge variant="success">ASSIGNED</Badge>
                        ) : (
                          <Badge variant="warning">UNASSIGNED</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant={primaryAdvisor ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => handleOpenAssignModal(target)}
                          >
                            {primaryAdvisor ? 'Reassign' : 'Appoint Advisor'}
                          </Button>
                          {primaryAdvisor && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeactivate(primaryAdvisor._id, facultyMatch?.facultyName || primaryAdvisor.facultyId)}
                              title="Deactivate Advisor"
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Class Advisor Appointment Modal */}
      {isModalOpen && activeTargetCohort && (
        <Modal
          isOpen={true}
          onClose={() => !assigning && setIsModalOpen(false)}
          title={`Appoint Class Advisor — ${activeTargetCohort.year} Section ${activeTargetCohort.section}`}
        >
          <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
            {formValidation && (
              <div style={{ padding: '8px 12px', background: 'var(--color-error-container)', color: 'var(--color-on-error-container)', borderRadius: '6px', fontSize: '0.8125rem' }}>
                {formValidation}
              </div>
            )}

            <div style={{ padding: '10px 12px', background: 'var(--color-surface-container-low)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-outline)' }}>TARGET CLASS</div>
              <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                Computer Science & Engineering — {activeTargetCohort.year} (Section {activeTargetCohort.section})
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                {(() => {
                  const cohortCtx = contexts.find(
                    (c) => c.year === activeTargetCohort.year && c.section === activeTargetCohort.section && c.department === 'CSE'
                  );
                  const y = cohortCtx?.academicYear || '—';
                  const s = cohortCtx?.semester || '—';
                  return `${y} • ${s}`;
                })()}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px' }}>
                Select Faculty Member to Appoint as Class Advisor *
              </label>
              <Select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                options={facultyList.map((f) => ({
                  value: f.facultyId,
                  label: `${f.facultyName} (${f.facultyId}) — ${f.designation}`,
                }))}
                required
                disabled={assigning}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={assigning}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={assigning}
              >
                {assigning ? 'Assigning...' : 'Appoint Class Advisor'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
