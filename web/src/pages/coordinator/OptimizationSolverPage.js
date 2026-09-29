import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  createTimetableVersion,
  submitTimetableForApproval,
} from '../../services/coordinatorService';

import { getTimetableVersions, getClassTimetable, getFacultyTimetable, generateTimetable } from '../../services/timetableService';
import { getAcademicContexts } from '../../services/academicContextService';
import { getCourses } from '../../services/courseService';
import { getFacultyList } from '../../services/facultyService';
import { getHODAllocations } from '../../services/hodAllocationService';

import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import Card from '../../components/common/Card';

export default function OptimizationSolverPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data Stores
  const [contexts, setContexts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [hodAllocations, setHodAllocations] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  
  // Versions for display
  const [versions, setVersions] = useState([]);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  // Assignment Plan UI State
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedContextId, setSelectedContextId] = useState('');
  
  const [generationStatus, setGenerationStatus] = useState('INITIAL'); // INITIAL, READY, GENERATING, GENERATED, ERROR
  const [generationResult, setGenerationResult] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [verRes, ctxRes, crsRes, facRes, hodRes] = await Promise.allSettled([
        getTimetableVersions(),
        getAcademicContexts(),
        getCourses({ limit: 500 }),
        getFacultyList({ limit: 100 }),
        getHODAllocations(),
      ]);

      if (verRes.status === 'fulfilled' && verRes.value) {
        setVersions(Array.isArray(verRes.value) ? verRes.value : verRes.value.data || []);
      }

      let allocList = [];
      if (hodRes.status === 'fulfilled' && hodRes.value) {
        allocList = Array.isArray(hodRes.value) ? hodRes.value : hodRes.value.data || [];
        setHodAllocations(allocList);
      }

      let crsList = [];
      if (crsRes.status === 'fulfilled' && crsRes.value) {
        crsList = Array.isArray(crsRes.value) 
          ? crsRes.value 
          : crsRes.value.items || crsRes.value.data?.items || crsRes.value.data || [];
        setCourses(crsList);
      }

      if (facRes.status === 'fulfilled' && facRes.value) {
        setFacultyList(facRes.value.items || facRes.value.data || (Array.isArray(facRes.value) ? facRes.value : []));
      }

      if (ctxRes.status === 'fulfilled' && ctxRes.value) {
        const ctxList = Array.isArray(ctxRes.value) ? ctxRes.value : ctxRes.value.data || [];
        setContexts(ctxList);
        
        if (ctxList.length > 0) {
          const uniqueYears = [...new Set(ctxList.map(c => c.year))].filter(Boolean);
          if (uniqueYears.length > 0) {
            setSelectedYear(uniqueYears[0]);
            
            const semsForYear = [...new Set(ctxList.filter(c => c.year === uniqueYears[0]).map(c => c.semester))].filter(Boolean);
            if (semsForYear.length > 0) {
              setSelectedSemester(semsForYear[0]);
              
              const secsForSem = ctxList.filter(c => c.year === uniqueYears[0] && c.semester === semsForYear[0]);
              if (secsForSem.length > 0) {
                setSelectedContextId(secsForSem[0]._id);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[OptimizationSolverPage] Failed to fetch:', err);
      setError(err.message || 'Unable to load solver data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derived filters
  const uniqueYears = [...new Set(contexts.map(c => c.year))].filter(Boolean);
  const uniqueSemesters = [...new Set(contexts.filter(c => c.year === selectedYear).map(c => c.semester))].filter(Boolean);
  const sections = contexts.filter(c => c.year === selectedYear && c.semester === selectedSemester);
  
  const yearToCurriculumSemester = {
    'II Year': 'Semester III',
    'III Year': 'Semester V',
    'IV Year': 'Semester VII'
  };
  const targetCurriculumSemester = yearToCurriculumSemester[selectedYear] || selectedSemester;
  const validCourses = courses.filter(c => c.semester === targetCurriculumSemester);

  const selectedContext = contexts.find(c => c._id === selectedContextId);

  // Auto-generate assignment plan derived from courses + context allocations
  const assignmentPlan = useMemo(() => {
    if (!selectedContextId || validCourses.length === 0) return [];
    
    return validCourses.map(course => {
      const allocations = hodAllocations.filter(a => 
        (a.academicContextId?._id || a.academicContextId) === selectedContextId && 
        a.courseCode === course.courseCode
      );
      
      const hasConflict = allocations.length > 1;
      const matchingAlloc = allocations[0];
      
      let status = 'REQUIRES HOD DECISION';
      if (hasConflict) status = 'CONFLICT';
      else if (matchingAlloc) status = 'READY';

      return {
        id: course.courseCode,
        contextId: selectedContextId,
        contextDisplay: `${selectedContext?.year} - ${selectedContext?.section}`,
        courseCode: course.courseCode,
        courseTitle: course.courseName,
        facultyId: matchingAlloc ? (matchingAlloc.facultyId?._id || matchingAlloc.facultyId) : null,
        facultyName: matchingAlloc ? matchingAlloc.facultyName : null,
        type: course.courseType || (course.isLab ? 'LAB' : 'THEORY'),
        requiredPeriods: course.totalPeriod || (course.L || 0) + (course.T || 0) + (course.P || 0) || 4,
        status,
        hasConflict
      };
    });
  }, [validCourses, hodAllocations, selectedContextId, selectedContext]);

  // Handle Cascades
  const handleYearChange = (year) => {
    setSelectedYear(year);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
    const sems = [...new Set(contexts.filter(c => c.year === year).map(c => c.semester))].filter(Boolean);
    if (sems.length > 0) {
      setSelectedSemester(sems[0]);
      const secs = contexts.filter(c => c.year === year && c.semester === sems[0]);
      if (secs.length > 0) setSelectedContextId(secs[0]._id);
    }
  };

  const handleSemesterChange = (sem) => {
    setSelectedSemester(sem);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
    const secs = contexts.filter(c => c.year === selectedYear && c.semester === sem);
    if (secs.length > 0) setSelectedContextId(secs[0]._id);
  };

  const handleContextChange = (id) => {
    setSelectedContextId(id);
    setGenerationStatus('INITIAL');
    setGenerationResult(null);
  };

  const isGenerateDisabled = assignmentPlan.length === 0 || 
                             assignmentPlan.some(p => p.status !== 'READY') || 
                             generationStatus === 'GENERATING';

  const handleGenerateTimetable = async () => {
    setGenerationStatus('GENERATING');
    setGenerationResult(null);
    
    try {
      const payload = {
        academicContextId: selectedContextId,
        assignmentPlan: assignmentPlan.map(p => ({
          courseCode: p.courseCode,
          facultyId: p.facultyId,
          requiredPeriods: p.requiredPeriods,
          type: p.type
        }))
      };
      
      const result = await generateTimetable(payload);
      
      setGenerationStatus('GENERATED');
      setGenerationResult(result);
      showToast('Timetable generation successful!', 'success');
    } catch (err) {
      console.error(err);
      setGenerationStatus('ERROR');
      showToast(`Generation failed: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Prepare Timetable Assignment"
        description="Build the course-faculty assignment plan and run the automated generation engine."
        breadcrumbs={[
          { label: 'Coordinator Portal', path: '/coordinator/dashboard' },
          { label: 'Timetable Design' },
        ]}
        badge={<Badge variant="secondary">AUTO-GENERATION ENGINE</Badge>}
      />

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <Spinner size="md" />
          <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
            Loading solver environment...
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'start' }}>
          
          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Assignment Builder Panel */}
            <Card style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.125rem', color: 'var(--color-primary)' }}>Prepare Assignment</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  {uniqueYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  {uniqueSemesters.map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>Class / Section</label>
                <select
                  value={selectedContextId}
                  onChange={(e) => handleContextChange(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}
                >
                  {sections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.department || 'CSE'} – {c.year} – {c.section}
                    </option>
                  ))}
                </select>
              </div>

              {/* Curriculum Courses Area */}
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--color-primary)' }}>
                  Curriculum Courses
                </h4>
                
                {validCourses.length === 0 ? (
                  <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)', color: 'var(--color-outline)' }}>
                    No curriculum courses found for this cohort.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
                    {assignmentPlan.map(plan => (
                      <div key={plan.courseCode} style={{ padding: '12px', backgroundColor: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>Course</label>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-on-surface)' }}>
                            {plan.courseCode} – {plan.courseTitle}
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: 'var(--color-on-surface-variant)' }}>Faculty Instructor</label>
                          {plan.status === 'READY' ? (
                            <div style={{ padding: '6px 8px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-outline-variant)' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{plan.facultyName}</span>
                                <Badge variant="success">HOD ALLOCATED</Badge>
                              </div>
                            </div>
                          ) : plan.status === 'CONFLICT' ? (
                            <div style={{ padding: '6px 8px', backgroundColor: 'var(--color-error-container)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-error)' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-error)' }}>
                                ⚠️ Conflicting HOD allocation
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-on-error-container)', marginTop: '4px' }}>
                                [HOD DECISION REQUIRED]
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '6px 8px', backgroundColor: 'var(--color-warning-container)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning)' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-warning-dark)' }}>
                                ⚠️ No HOD allocation for this course
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-on-warning-container)', marginTop: '4px' }}>
                                [REQUIRES HOD DECISION]
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Right Panel: Plan & Engine */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', gridColumn: 'span 2' }}>
              <Card style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--color-primary)' }}>Course–Faculty Assignment Plan</h3>
                  {assignmentPlan.length > 0 && (
                    <Badge variant="secondary">{assignmentPlan.length} Courses</Badge>
                  )}
                </div>

                {assignmentPlan.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-outline)', border: '2px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                    No assignments available for the selected cohort.
                  </div>
                ) : (
                  <div className="ui-table-scroll-container">
                    <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-surface-container-low)', textAlign: 'left', borderBottom: '1px solid var(--color-surface-container)' }}>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Code</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Course Title</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Faculty</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Required Periods</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignmentPlan.map((plan) => (
                          <tr key={plan.id} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>{plan.courseCode}</td>
                            <td style={{ padding: '12px 16px' }}>{plan.courseTitle}</td>
                            <td style={{ padding: '12px 16px' }}>{plan.facultyName || 'Unassigned'}</td>
                            <td style={{ padding: '12px 16px' }}>{plan.type}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>{plan.requiredPeriods}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <Badge variant={plan.status === 'READY' ? 'success' : plan.status === 'CONFLICT' ? 'error' : 'warning'}>{plan.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Status:</span>
                    <Badge variant={generationStatus === 'GENERATING' ? 'warning' : isGenerateDisabled ? 'error' : 'neutral'}>
                      {generationStatus === 'GENERATING' ? 'GENERATING' : (isGenerateDisabled ? 'BLOCKED' : 'READY')}
                    </Badge>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={isGenerateDisabled}
                    onClick={handleGenerateTimetable}
                  >
                    {generationStatus === 'GENERATING' ? 'Generating Timetable...' : 'Generate Timetable'}
                  </Button>
                </div>
              </Card>

              {/* Generation Output Area */}
              {(generationStatus === 'ERROR' || generationStatus === 'GENERATED') && (
                <Card style={{ padding: '20px', borderLeft: generationStatus === 'ERROR' ? '4px solid var(--color-error)' : '4px solid var(--color-success)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.125rem', color: generationStatus === 'ERROR' ? 'var(--color-error)' : 'var(--color-success)' }}>
                    Generation Status: {generationStatus === 'ERROR' ? 'FAILED' : 'SUCCESSFUL'}
                  </h3>
                  
                  {generationStatus === 'ERROR' ? (
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-error)' }}>
                        An error occurred while generating the timetable. Please check the backend logs.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                        <strong>Academic Context:</strong> {selectedYear} | Semester {selectedSemester}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '0.875rem', padding: '12px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-md)' }}>
                        <div><strong>Course Assignments:</strong> {assignmentPlan.length}</div>
                        <div><strong>Theory Courses:</strong> {assignmentPlan.filter(p => p.type === 'THEORY').length}</div>
                        <div><strong>Lab Courses:</strong> {assignmentPlan.filter(p => p.type === 'LAB').length}</div>
                        <div><strong>Generated Sessions:</strong> {generationResult?.sessionsCount || generationResult?.data?.sessionsCount || 0}</div>
                        <div><strong>Seed:</strong> {generationResult?.seed || generationResult?.data?.seed || 'N/A'}</div>
                      </div>

                      <p style={{ margin: '0 0 12px 0', lineHeight: 1.5, color: 'var(--color-on-surface-variant)', fontSize: '0.875rem' }}>
                        The timetable generation engine has successfully processed the assignments and applied all strict constraints (faculty cross-class conflicts, theory distribution, lab continuous blocks).
                      </p>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
