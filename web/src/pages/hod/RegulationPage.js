import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import { getR22CurriculumOverview, getCourses } from '../../services/courseService';

/**
 * Authoritative R22 Curriculum Semester Totals & Descriptions
 * Source: docs/R22_CSE_2024_25_Onwards_Semester_Details.md
 */
const SEMESTER_METRICS = {
  'Semester I': {
    roman: 'I',
    periods: 29,
    ltp: 'L=15, T=1, P=13',
    coreCount: 11,
    electiveSlotCount: 0,
    theme: 'Basic Sciences, Foundation Computing & Professional Communication',
  },
  'Semester II': {
    roman: 'II',
    periods: 34,
    ltp: 'L=16, T=1, P=17',
    coreCount: 11,
    electiveSlotCount: 0,
    theme: 'Data Structures, Python, Digital Principles & Engineering Graphics',
  },
  'Semester III': {
    roman: 'III',
    periods: 32,
    ltp: 'L=17, T=1, P=14',
    coreCount: 10,
    electiveSlotCount: 0,
    theme: 'Discrete Mathematics, Algorithms, Computer Networks, Java & Operating Systems',
  },
  'Semester IV': {
    roman: 'IV',
    periods: 32,
    ltp: 'L=19, T=1, P=13',
    coreCount: 10,
    electiveSlotCount: 0,
    theme: 'AI & ML, Theory of Computation, DBMS, Advanced Java & Foundations of Data Science',
  },
  'Semester V': {
    roman: 'V',
    periods: 30,
    ltp: 'L=19, T=1, P=10',
    coreCount: 6,
    electiveSlotCount: 3,
    theme: 'Compiler Design, Full Stack Development, OOSE & Professional Elective Slots (E1, E2, E3)',
  },
  'Semester VI': {
    roman: 'VI',
    periods: 26,
    ltp: 'L=18, T=0, P=8',
    coreCount: 4,
    electiveSlotCount: 4,
    theme: 'Internet of Things, Mobile Applications, Management Elective (EM) & Elective Slots (E4, E5, E6)',
  },
  'Semester VII': {
    roman: 'VII',
    periods: 14,
    ltp: 'L=14, T=0, P=0',
    coreCount: 2,
    electiveSlotCount: 4,
    theme: 'Universal Human Values, Industrial Internship & Open/Programme Elective Slots (E7, E8, E9, E10)',
  },
  'Semester VIII': {
    roman: 'VIII',
    periods: 20,
    ltp: 'L=0, T=0, P=20',
    coreCount: 1,
    electiveSlotCount: 0,
    theme: 'Capstone Project Work & Industry Research Dissertation',
  },
};

/**
 * Elective slot definitions are dynamically sourced from the authoritative backend curriculum endpoint:
 * GET /api/courses/curriculum/r22 (FE-P2-011)
 */

const PEC_VERTICAL_NAMES = [
  'Vertical I: Machine Intelligence',
  'Vertical II: Data Analytics',
  'Vertical III: Cyber Security',
  'Vertical IV: Internet of Things',
  'Vertical V: Web Development',
  'Vertical VI: Software Development Engineering',
];

const CATEGORIES = [
  { code: 'ALL', label: 'All Categories' },
  { code: 'PCC', label: 'PCC — Professional Core Courses' },
  { code: 'PEC', label: 'PEC — Programme Elective Courses' },
  { code: 'BSC', label: 'BSC — Basic Science Courses' },
  { code: 'ESC', label: 'ESC — Engineering Science Courses' },
  { code: 'HSMC', label: 'HSMC — Humanities, Social Sciences & Management' },
  { code: 'OEC', label: 'OEC — Open Elective Courses' },
  { code: 'EEC', label: 'EEC — Employability Enhancement Courses' },
  { code: 'MC', label: 'MC — Mandatory Non-Credit Courses' },
];

export default function RegulationPage() {
  const [curriculumData, setCurriculumData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View state
  const [selectedTab, setSelectedTab] = useState('ALL'); // 'ALL' | 'SEM_I' ... 'SEM_VIII' | 'PEC' | 'MANAGEMENT' | 'OEC' | 'SLOT_MAP'
  const [selectedVertical, setSelectedVertical] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt dedicated curriculum overview endpoint first
      let res = await getR22CurriculumOverview().catch(() => null);

      if (!res || !res.courses) {
        // Fallback to standard courses endpoint with high limit to capture full curriculum
        const fallbackRes = await getCourses({ regulation: 'R22', limit: 200 });
        const list = Array.isArray(fallbackRes)
          ? fallbackRes
          : fallbackRes?.items || fallbackRes?.data || [];
        setCourses(list);
        setCurriculumData({
          curriculumCode: 'R22-CSE',
          regulation: 'R22 Regulations',
          institution: 'Nandha Engineering College (Autonomous)',
          affiliation: 'Anna University Affiliated',
          applicableFrom: 'Academic Year 2024–2025 onwards',
          degreeLevels: 'B.E. (UG) & M.E. (PG)',
          duration: '8 Semesters (4 Academic Years)',
          totalCourses: list.length,
          courses: list,
          electiveSlotMap: {},
        });
      } else {
        const payload = res.data || res;
        setCurriculumData(payload);
        setCourses(payload.courses || []);
      }
    } catch (err) {
      console.error('[RegulationPage] Failed to fetch curriculum data:', err);
      setError(err.message || 'Unable to connect to curriculum registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered courses calculation
  const displayedCourses = useMemo(() => {
    let list = [...courses];
    const electiveSlotMap = curriculumData?.electiveSlotMap || {};

    // Tab-level filtering
    if (selectedTab.startsWith('SEM_')) {
      const roman = selectedTab.replace('SEM_', '');
      const semKey = `Semester ${roman}`;
      const coreInSem = list.filter((c) => {
        const cSem = (c.semester || '').toUpperCase().trim();
        return cSem === semKey.toUpperCase() || cSem === `SEMESTER ${roman}` || cSem === roman;
      });

      // Interleave or append authoritative elective slots from server
      const slots = electiveSlotMap[semKey] || [];
      list = [...coreInSem, ...slots];
    } else if (selectedTab === 'PEC') {
      list = list.filter((c) => c.category === 'PEC' || c.electiveType === 'PEC');
      if (selectedVertical !== 'ALL') {
        const cleanVert = selectedVertical.replace(/^Vertical\s+[IVX]+:\s*/i, '').trim().toLowerCase();
        list = list.filter((c) => {
          const v = (c.vertical || '').toLowerCase();
          return v.includes(cleanVert);
        });
      }
    } else if (selectedTab === 'MANAGEMENT') {
      const mgmtCodes = ['22GEA02', '22GEA03', '22GEA04', '22GEZ01'];
      list = list.filter((c) => mgmtCodes.includes(c.courseCode) || (c.electiveType || '').includes('Management'));
    } else if (selectedTab === 'OEC') {
      const oecCodes = ['22CSZ01', '22CSZ02'];
      list = list.filter((c) => oecCodes.includes(c.courseCode) || c.category === 'OEC' || c.electiveType === 'OEC');
    }

    // Category filtering
    if (selectedCategory !== 'ALL') {
      list = list.filter((c) => {
        const cat = (c.category || '').toUpperCase();
        return cat === selectedCategory || (selectedCategory === 'PEC' && cat.includes('PEC'));
      });
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          (c.courseCode && c.courseCode.toLowerCase().includes(q)) ||
          (c.courseName && c.courseName.toLowerCase().includes(q)) ||
          (c.prerequisite && c.prerequisite.toLowerCase().includes(q)) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          (c.vertical && c.vertical.toLowerCase().includes(q))
      );
    }

    return list;
  }, [courses, selectedTab, selectedVertical, selectedCategory, searchQuery]);

  // Active semester metadata helper
  const activeSemKey = selectedTab.startsWith('SEM_') ? `Semester ${selectedTab.replace('SEM_', '')}` : null;
  const activeSemMeta = activeSemKey ? SEMESTER_METRICS[activeSemKey] : null;

  return (
    <div>
      <PageHeader
        title="Academic Regulation Management"
        description="Statutory management of academic curriculum regulations, workload limits, and Principal-mandated rules."
        breadcrumbs={[
          { label: 'HOD Portal', path: '/hod/dashboard' },
          { label: 'Academic Regulation' },
        ]}
        badge={<Badge variant="primary">OFFICIAL CURRICULUM REFERENCE</Badge>}
      />

      {/* Top Authority & Governance Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Active Regulation Authority */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Active Regulation Authority
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                R22 Regulations
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', marginTop: '2px', fontWeight: 500 }}>
                Nandha Engineering College (Autonomous) • Anna University Affiliated
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface-container-high)',
                color: 'var(--color-primary)',
              }}
            >
              R22-CSE
            </span>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-surface-container)',
              marginTop: '16px',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Academic Applicability:</span>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Academic Year 2024–2025 onwards</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Degree Levels:</span>
              <span style={{ fontWeight: 600 }}>B.E. (UG) & M.E. (PG)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Curriculum Duration:</span>
              <span style={{ fontWeight: 600 }}>8 Semesters (4 Academic Years)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Curriculum Register:</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-secondary)' }}>
                109 Courses across 8 Semesters
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Governance Status:</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#16a34a' }}>
                ✓ Official Active Statutory Curriculum
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Principal-Defined Workload Rules */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-outline)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Principal-Defined Workload Rules
              </div>
              <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                16 Periods / Week
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-on-surface-variant)', marginTop: '2px', fontWeight: 500 }}>
                Statutory standard weekly faculty teaching norm
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0, 81, 213, 0.08)',
                color: 'var(--color-secondary)',
              }}
            >
              Principal Mandate
            </span>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-surface-container)',
              marginTop: '16px',
              paddingTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Theory Course Weight:</span>
              <span style={{ fontWeight: 600 }}>1 Credit = 1 Contact Hour</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Laboratory Course Weight:</span>
              <span style={{ fontWeight: 600 }}>1 Credit = 2 Contact Hours</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Max Continuous Lab Slots:</span>
              <span style={{ fontWeight: 600 }}>3 Periods (Lab Session)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Regulatory Policy:</span>
              <span style={{ fontWeight: 600 }}>Institutional Workload Policy</span>
            </div>
            <div
              style={{
                marginTop: '4px',
                padding: '8px 10px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-surface-container-low)',
                fontSize: '0.75rem',
                color: 'var(--color-on-surface-variant)',
                lineHeight: 1.4,
              }}
            >
              ℹ️ Distinct institutional rules governing faculty allocation and timetable solver constraints; maintained independently from academic curriculum course structure.
            </div>
          </div>
        </Card>
      </div>

      {/* Curriculum Metrics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
            Total Curriculum Courses
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            109
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            Authoritative R22 Register
          </div>
        </Card>

        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
            Core Instructional Courses
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            55
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            Semesters I to VIII
          </div>
        </Card>

        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
            Programme Electives (PEC)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            48
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            6 Specialized Verticals
          </div>
        </Card>

        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
            Management & Open Electives
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            6
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
            4 Management + 2 Open (OEC)
          </div>
        </Card>
      </div>

      {/* Main Curriculum Explorer Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {/* Top Control Bar: Tabbed Navigation */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-surface-container)',
            backgroundColor: 'var(--color-surface-bright)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                R22 Curriculum Course Register
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
                Official course metadata, contact distribution (L-T-P), prerequisites, and elective slot mappings.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-outline)' }}>
                Showing <strong>{displayedCourses.length}</strong> {selectedTab === 'SLOT_MAP' ? 'slots' : 'courses'}
              </span>
              <Button variant="outline" size="sm" icon="🔄" onClick={loadData}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Primary View Mode / Semester Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {[
              { id: 'ALL', label: 'All Courses' },
              { id: 'SEM_I', label: 'Sem I' },
              { id: 'SEM_II', label: 'Sem II' },
              { id: 'SEM_III', label: 'Sem III' },
              { id: 'SEM_IV', label: 'Sem IV' },
              { id: 'SEM_V', label: 'Sem V' },
              { id: 'SEM_VI', label: 'Sem VI' },
              { id: 'SEM_VII', label: 'Sem VII' },
              { id: 'SEM_VIII', label: 'Sem VIII' },
              { id: 'PEC', label: 'PEC Verticals' },
              { id: 'MANAGEMENT', label: 'Management' },
              { id: 'OEC', label: 'Open Electives' },
              { id: 'SLOT_MAP', label: 'Elective Slot Map' },
            ].map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedTab(tab.id);
                    if (tab.id !== 'PEC') setSelectedVertical('ALL');
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 700 : 500,
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--color-primary)' : 'transparent',
                    backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Secondary Filter & Search Strip (Only when not in SLOT_MAP view) */}
          {selectedTab !== 'SLOT_MAP' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                paddingTop: '10px',
                borderTop: '1px solid var(--color-surface-container)',
              }}
            >
              {/* Search Input */}
              <div style={{ flex: '1 1 260px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search by course code, title, or prerequisite..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    fontSize: '0.8125rem',
                    border: '1px solid var(--color-outline-variant, #cbdbf5)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-bright)',
                    color: 'var(--color-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-outline)',
                    fontSize: '0.875rem',
                  }}
                >
                  🔍
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-outline)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Dropdown */}
              <div style={{ flex: '0 1 240px' }}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.8125rem',
                    border: '1px solid var(--color-outline-variant, #cbdbf5)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-surface-bright)',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-vertical Selector when PEC tab is active */}
              {selectedTab === 'PEC' && (
                <div style={{ flex: '0 1 280px' }}>
                  <select
                    value={selectedVertical}
                    onChange={(e) => setSelectedVertical(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--color-outline-variant, #cbdbf5)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-surface-bright)',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="ALL">All 6 Verticals (48 Courses)</option>
                    {PEC_VERTICAL_NAMES.map((vert) => (
                      <option key={vert} value={vert}>
                        {vert} (8 Courses)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset Filters Shortcut */}
              {(selectedCategory !== 'ALL' || searchQuery || (selectedTab === 'PEC' && selectedVertical !== 'ALL')) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedVertical('ALL');
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--color-secondary)',
                    background: 'none',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Semester-Specific Authoritative Summary Banner */}
        {activeSemMeta && (
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--color-surface-container-low)',
              borderBottom: '1px solid var(--color-surface-container)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                {activeSemKey} Structure:
              </span>
              <span style={{ color: 'var(--color-on-surface)' }}>
                {activeSemMeta.theme}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span>
                Total Periods:{' '}
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                  {activeSemMeta.periods}
                </strong>
              </span>
              <span>
                Distribution:{' '}
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                  {activeSemMeta.ltp}
                </strong>
              </span>
              {activeSemMeta.electiveSlotCount > 0 && (
                <span style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                  Includes {activeSemMeta.electiveSlotCount} Elective Slots
                </span>
              )}
            </div>
          </div>
        )}

        {/* View Content Area */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '56px 0' }}>
            <Spinner size="md" />
            <div style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--color-outline)' }}>
              Loading authoritative R22 curriculum register...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '32px' }}>
            <ErrorState message={error} onRetry={loadData} />
          </div>
        ) : selectedTab === 'SLOT_MAP' ? (
          /* Dedicated Elective Slot Map View */
          <div style={{ padding: '24px 20px' }}>
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                R22 Curriculum Elective Slot Mapping
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
                Official statutory allocation framework defining eligible course types for each elective slot in Semesters V, VI, and VII.
              </p>
            </div>

            <div className="ui-table-scroll-container">
              <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--color-surface-container-low)',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--color-surface-container)',
                      color: 'var(--color-on-surface-variant)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Semester</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Slot Code</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Slot Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Contact (L-T-P)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Total Period</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Allowed Elective Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Eligible Course Pool</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(curriculumData?.electiveSlotMap || {}).flat().map((slot, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        backgroundColor: idx % 2 === 0 ? 'var(--color-surface-bright)' : 'var(--color-surface-container-lowest)',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {slot.semester}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-secondary)' }}>
                        {slot.slot}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {slot.courseName}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--color-surface-container)', color: 'var(--color-primary)' }}>
                          {slot.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        {slot.contactPeriod}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {slot.totalPeriod}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {slot.allowedType}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)' }}>
                        {slot.eligiblePool}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-surface-container)',
                fontSize: '0.8125rem',
                color: 'var(--color-on-surface)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px' }}>
                Curriculum Elective Mapping Guidelines:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Semester V:</strong> E1 &amp; E2 are restricted to Programme Electives (PEC); E3 allows choice between PEC or Open Elective (OEC).</li>
                <li><strong>Semester VI:</strong> EM is reserved for Management Electives; E4 &amp; E5 are PEC; E6 is PEC or OEC.</li>
                <li><strong>Semester VII:</strong> E7 is PEC; E8 is PEC or OEC; E9 &amp; E10 are strictly Open Electives (OEC).</li>
              </ul>
            </div>
          </div>
        ) : displayedCourses.length === 0 ? (
          <div style={{ padding: '48px 24px' }}>
            <EmptyState
              title="No courses found"
              description="No curriculum courses match your active tab, category, or search filters."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    setSelectedVertical('ALL');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </Button>
              }
            />
          </div>
        ) : (
          /* Main Curriculum Course Table */
          <div className="ui-table-scroll-container">
            <table style={{ width: '100%', minWidth: '960px', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-surface-container-low)',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--color-surface-container)',
                    color: 'var(--color-on-surface-variant)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Course Code</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Course Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Semester / Track</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Pre-requisite</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Contact Period</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>L-T-P</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Total Period</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {displayedCourses.map((course, idx) => {
                  const isSlot = Boolean(course.isSlot);
                  const isLabCourse = course.isLab || (course.category === 'ESC' && course.courseCode.includes('P')) || course.courseCode.includes('CSP') || course.courseCode.includes('ECP') || course.courseCode.includes('MEP');

                  return (
                    <tr
                      key={course.courseCode || idx}
                      style={{
                        borderBottom: '1px solid var(--color-surface-container)',
                        backgroundColor: isSlot
                          ? 'rgba(0, 81, 213, 0.03)'
                          : idx % 2 === 0
                          ? 'var(--color-surface-bright)'
                          : 'var(--color-surface-container-lowest)',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="ui-table-row-hover"
                    >
                      {/* Course Code */}
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: isSlot ? 'var(--color-secondary)' : 'var(--color-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {course.courseCode}
                      </td>

                      {/* Course Title */}
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{course.courseName || course.title}</span>
                          {isSlot && (
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-on-primary)',
                              }}
                            >
                              ELECTIVE SLOT
                            </span>
                          )}
                        </div>
                        {course.vertical && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-outline)', marginTop: '2px' }}>
                            Vertical: {course.vertical}
                          </div>
                        )}
                        {course.slotNote && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', marginTop: '2px' }}>
                            Allocation: {course.slotNote}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              course.category === 'PCC'
                                ? 'rgba(0, 81, 213, 0.1)'
                                : course.category === 'PEC' || (course.category || '').includes('PEC')
                                ? 'rgba(33, 161, 115, 0.12)'
                                : course.category === 'BSC'
                                ? 'rgba(100, 116, 139, 0.12)'
                                : course.category === 'HSMC'
                                ? 'rgba(217, 119, 6, 0.12)'
                                : 'var(--color-surface-container)',
                            color:
                              course.category === 'PCC'
                                ? 'var(--color-secondary)'
                                : course.category === 'PEC' || (course.category || '').includes('PEC')
                                ? '#059669'
                                : course.category === 'BSC'
                                ? '#475569'
                                : course.category === 'HSMC'
                                ? '#b45309'
                                : 'var(--color-primary)',
                          }}
                        >
                          {course.category || '—'}
                        </span>
                      </td>

                      {/* Semester / Track */}
                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                        {course.semester || (course.vertical ? `PEC: ${course.vertical}` : '—')}
                      </td>

                      {/* Pre-requisite */}
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: course.prerequisite && course.prerequisite !== '-' && course.prerequisite !== '—' ? 'var(--font-mono)' : 'inherit',
                          fontWeight: course.prerequisite && course.prerequisite !== '-' && course.prerequisite !== '—' ? 700 : 400,
                          color: course.prerequisite && course.prerequisite !== '-' && course.prerequisite !== '—' ? 'var(--color-secondary)' : 'var(--color-outline)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {course.prerequisite && course.prerequisite !== '-' ? course.prerequisite : '—'}
                      </td>

                      {/* Contact Period */}
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8125rem',
                          textAlign: 'right',
                          color: 'var(--color-on-surface)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {course.contactPeriod || '—'}
                      </td>

                      {/* L-T-P */}
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8125rem',
                          textAlign: 'center',
                          fontWeight: 600,
                          color: isLabCourse ? '#059669' : 'var(--color-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {course.L !== undefined ? `${course.L}-${course.T}-${course.P}` : (course.lecture !== undefined ? `${course.lecture}-${course.tutorial || 0}-${course.practical || 0}` : '—')}
                      </td>

                      {/* Total Period */}
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          textAlign: 'right',
                          color: 'var(--color-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {course.totalPeriod !== undefined && course.totalPeriod !== '-' ? course.totalPeriod : (course.contactHours || '—')}
                      </td>

                      {/* Credits */}
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          textAlign: 'right',
                          color: 'var(--color-secondary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {course.credits !== undefined ? course.credits : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Audit Summary */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--color-surface-container)',
            backgroundColor: 'var(--color-surface-container-low)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.75rem',
            color: 'var(--color-on-surface-variant)',
          }}
        >
          <div>
            <strong>Curriculum Code:</strong> R22-CSE • <strong>Affiliation:</strong> Anna University • <strong>Department:</strong> Computer Science and Engineering
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Statutory Mode:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
              Read-Only Governance Register
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
