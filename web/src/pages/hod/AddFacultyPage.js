import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { createFaculty } from '../../services/facultyService';
import {
  DEFAULT_DEPARTMENT,
  isValidResponsibilityRole,
} from '../../constants/responsibilityMaster';

// Subcomponents
import FacultyBasicInfoForm from '../../components/faculty/FacultyBasicInfoForm';
import TheoryAllocationRow from '../../components/faculty/TheoryAllocationRow';
import LabAllocationRow from '../../components/faculty/LabAllocationRow';
import PGAllocationRow from '../../components/faculty/PGAllocationRow';
import OtherAllocationRow from '../../components/faculty/OtherAllocationRow';
import ResponsibilityRow from '../../components/faculty/ResponsibilityRow';
import WorkloadSummary from '../../components/faculty/WorkloadSummary';
import SuccessWorkloadSummary from '../../components/faculty/SuccessWorkloadSummary';

const INITIAL_FORM_STATE = {
  facultyName: '',
  designation: 'Assistant Professor',
  department: DEFAULT_DEPARTMENT,
  email: '',
  phone: '',
  roles: ['FACULTY'],
  teaching: {
    ugTheory1: [{ courseCode: '', courseName: '', allocation: 'UG III Year A', hours: 3 }],
    ugTheory2: [{ courseCode: '', courseName: '', allocation: 'UG III Year B', hours: 3 }],
    lab1: [{ courseCode: '', courseName: '', allocation: 'UG III Year A', hours: 4 }],
    lab2: [{ courseCode: '', courseName: '', allocation: 'UG III Year B', hours: 4 }],
    pg: [],
    others: [],
  },
  responsibilities: [
    { role: 'Class Advisor', allocation: 'UG III Year A', hours: 2 },
  ],
};

export default function AddFacultyPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);

  // -------------------------------------------------------------
  // Section Row Handlers
  // -------------------------------------------------------------

  const handleBasicInfoChange = (newInfo) => {
    setFormData((prev) => ({
      ...prev,
      facultyName: newInfo.facultyName,
      designation: newInfo.designation,
      department: newInfo.department,
      email: newInfo.email,
      phone: newInfo.phone,
    }));
    // Clear basic errors on change
    if (errors.facultyName || errors.designation || errors.email) {
      setErrors((prev) => ({ ...prev, facultyName: null, designation: null, email: null }));
    }
  };

  const handleTeachingListChange = (categoryKey, updatedList) => {
    setFormData((prev) => ({
      ...prev,
      teaching: {
        ...prev.teaching,
        [categoryKey]: updatedList,
      },
    }));
  };

  // Add Row
  const addTheoryRow = (categoryKey) => {
    const defaultAlloc = categoryKey === 'ugTheory1' ? 'UG III Year A' : 'UG III Year B';
    const current = formData.teaching[categoryKey] || [];
    handleTeachingListChange(categoryKey, [
      ...current,
      { courseCode: '', courseName: '', allocation: defaultAlloc, hours: 3 },
    ]);
  };

  const addLabRow = (categoryKey) => {
    const defaultAlloc = categoryKey === 'lab1' ? 'UG III Year A' : 'UG III Year B';
    const current = formData.teaching[categoryKey] || [];
    handleTeachingListChange(categoryKey, [
      ...current,
      { courseCode: '', courseName: '', allocation: defaultAlloc, hours: 4 },
    ]);
  };

  const addPGRow = () => {
    const current = formData.teaching.pg || [];
    handleTeachingListChange('pg', [
      ...current,
      { courseCode: '', courseName: '', allocation: 'PG I Year' },
    ]);
  };

  const addOthersRow = () => {
    const current = formData.teaching.others || [];
    handleTeachingListChange('others', [
      ...current,
      { courseName: '', allocation: 'UG II Year A', hours: 2 },
    ]);
  };

  const addResponsibilityRow = () => {
    setFormData((prev) => ({
      ...prev,
      responsibilities: [
        ...prev.responsibilities,
        { role: '', allocation: 'Department', hours: 2 },
      ],
    }));
  };

  // Update Row
  const updateRow = (categoryKey, index, updatedItem) => {
    const list = [...(formData.teaching[categoryKey] || [])];
    list[index] = updatedItem;
    handleTeachingListChange(categoryKey, list);
  };

  const updateResponsibilityRow = (index, updatedItem) => {
    const list = [...formData.responsibilities];
    list[index] = updatedItem;
    setFormData((prev) => ({ ...prev, responsibilities: list }));
  };

  // Remove Row
  const removeRow = (categoryKey, index) => {
    const list = formData.teaching[categoryKey].filter((_, i) => i !== index);
    handleTeachingListChange(categoryKey, list);
  };

  const removeResponsibilityRow = (index) => {
    const list = formData.responsibilities.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, responsibilities: list }));
  };

  // -------------------------------------------------------------
  // Comprehensive Frontend Validation
  // -------------------------------------------------------------
  const validateForm = () => {
    const newErrors = {};
    const errorList = [];

    // 1. Basic Info
    if (!formData.facultyName || !formData.facultyName.trim()) {
      newErrors.facultyName = 'Faculty Name is required';
      errorList.push('Faculty Name is required');
    }
    if (!formData.designation || !formData.designation.trim()) {
      newErrors.designation = 'Designation is required';
      errorList.push('Designation is required');
    }
    if (!formData.department || !formData.department.trim()) {
      newErrors.department = 'Department is required';
      errorList.push('Department is required');
    }
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Invalid email address format';
        errorList.push('Invalid email address format');
      }
    }

    // 2. UG Theory rows check
    ['ugTheory1', 'ugTheory2'].forEach((cat) => {
      (formData.teaching[cat] || []).forEach((row, idx) => {
        if (!row.courseName || !row.courseName.trim()) {
          const err = `Missing Course Title in ${cat === 'ugTheory1' ? 'UG Theory 1' : 'UG Theory 2'} (Row ${idx + 1})`;
          newErrors[`${cat}_${idx}_courseName`] = err;
          errorList.push(err);
        }
        if (row.hours !== undefined && row.hours !== null && row.hours !== '') {
          if (isNaN(Number(row.hours)) || Number(row.hours) < 0) {
            const err = `Invalid hours in ${cat === 'ugTheory1' ? 'UG Theory 1' : 'UG Theory 2'} (Row ${idx + 1})`;
            newErrors[`${cat}_${idx}_hours`] = err;
            errorList.push(err);
          }
        }
      });
    });

    // 3. Lab rows check
    ['lab1', 'lab2'].forEach((cat) => {
      (formData.teaching[cat] || []).forEach((row, idx) => {
        if (!row.courseName || !row.courseName.trim()) {
          const err = `Missing Lab Title in ${cat === 'lab1' ? 'Lab 1' : 'Lab 2'} (Row ${idx + 1})`;
          newErrors[`${cat}_${idx}_courseName`] = err;
          errorList.push(err);
        }
        if (row.hours !== undefined && row.hours !== null && row.hours !== '') {
          if (isNaN(Number(row.hours)) || Number(row.hours) < 0) {
            const err = `Invalid hours in ${cat === 'lab1' ? 'Lab 1' : 'Lab 2'} (Row ${idx + 1})`;
            newErrors[`${cat}_${idx}_hours`] = err;
            errorList.push(err);
          }
        }
      });
    });

    // 4. PG rows check
    (formData.teaching.pg || []).forEach((row, idx) => {
      if (!row.courseName || !row.courseName.trim()) {
        const err = `Missing PG Course Title (Row ${idx + 1})`;
        newErrors[`pg_${idx}_courseName`] = err;
        errorList.push(err);
      }
    });

    // 5. Others rows check (1–3 hours strictly)
    (formData.teaching.others || []).forEach((row, idx) => {
      if (!row.courseName || !row.courseName.trim()) {
        const err = `Missing Activity / Title in Others (Row ${idx + 1})`;
        newErrors[`others_${idx}_courseName`] = err;
        errorList.push(err);
      }
      const h = Number(row.hours);
      if (isNaN(h) || h < 1 || h > 3) {
        const err = `Others hours must be strictly between 1 and 3 (Row ${idx + 1})`;
        newErrors[`others_${idx}_hours`] = err;
        errorList.push(err);
      }
    });

    // 6. Responsibilities check (1–6 hours, authoritative 38 roles, duplicate check)
    const seenRoles = new Set();
    formData.responsibilities.forEach((row, idx) => {
      if (!row.role || !row.role.trim()) {
        const err = `Please select a Responsibility Role (Row ${idx + 1})`;
        newErrors[`resp_${idx}_role`] = err;
        errorList.push(err);
      } else {
        const roleTrimmed = row.role.trim();
        if (!isValidResponsibilityRole(roleTrimmed)) {
          const err = `Responsibility '${roleTrimmed}' is not recognized in the 38-role master (Row ${idx + 1})`;
          newErrors[`resp_${idx}_role`] = err;
          errorList.push(err);
        }

        const roleLower = roleTrimmed.toLowerCase();
        if (seenRoles.has(roleLower)) {
          const err = `Duplicate responsibility '${roleTrimmed}' found (Row ${idx + 1}). Each duty can be assigned only once.`;
          newErrors[`resp_${idx}_role`] = err;
          errorList.push(err);
        } else {
          seenRoles.add(roleLower);
        }
      }

      const h = Number(row.hours);
      if (isNaN(h) || h < 1 || h > 6) {
        const err = `Responsibility hours must be strictly between 1 and 6 (Row ${idx + 1})`;
        newErrors[`resp_${idx}_hours`] = err;
        errorList.push(err);
      }
    });

    setErrors(newErrors);
    return {
      isValid: errorList.length === 0,
      errorList,
    };
  };

  // -------------------------------------------------------------
  // Submission Flow
  // -------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const { isValid, errorList } = validateForm();
    if (!isValid) {
      showToast(errorList[0] || 'Please correct the errors in the form before submitting', 'error');
      // Scroll to first error
      window.scrollTo({ top: 150, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build clean payload strictly complying with Verified Contract
      const payload = {
        facultyName: formData.facultyName.trim(),
        designation: formData.designation.trim(),
        department: formData.department.trim(),
        email: formData.email && formData.email.trim() ? formData.email.trim() : undefined,
        phone: formData.phone && formData.phone.trim() ? formData.phone.trim() : undefined,
        roles: ['FACULTY'],
        teaching: {
          ugTheory1: (formData.teaching.ugTheory1 || [])
            .filter((i) => i.courseName && i.courseName.trim())
            .map((i) => ({
              courseCode: i.courseCode ? i.courseCode.trim() : null,
              courseName: i.courseName.trim(),
              allocation: i.allocation ? i.allocation.trim() : null,
              hours: Number(i.hours) || 0,
            })),
          ugTheory2: (formData.teaching.ugTheory2 || [])
            .filter((i) => i.courseName && i.courseName.trim())
            .map((i) => ({
              courseCode: i.courseCode ? i.courseCode.trim() : null,
              courseName: i.courseName.trim(),
              allocation: i.allocation ? i.allocation.trim() : null,
              hours: Number(i.hours) || 0,
            })),
          lab1: (formData.teaching.lab1 || [])
            .filter((i) => i.courseName && i.courseName.trim())
            .map((i) => ({
              courseCode: i.courseCode ? i.courseCode.trim() : null,
              courseName: i.courseName.trim(),
              allocation: i.allocation ? i.allocation.trim() : null,
              hours: Number(i.hours) || 0,
            })),
          lab2: (formData.teaching.lab2 || [])
            .filter((i) => i.courseName && i.courseName.trim())
            .map((i) => ({
              courseCode: i.courseCode ? i.courseCode.trim() : null,
              courseName: i.courseName.trim(),
              allocation: i.allocation ? i.allocation.trim() : null,
              hours: Number(i.hours) || 0,
            })),
          pg: (formData.teaching.pg || [])
            .filter((i) => i.courseName && i.courseName.trim())
            .map((i) => ({
              courseCode: i.courseCode ? i.courseCode.trim() : null,
              courseName: i.courseName.trim(),
              allocation: i.allocation ? i.allocation.trim() : null,
            })),
          others: (formData.teaching.others || [])
            .filter((i) => i.courseName && i.courseName.trim())
            .map((i) => ({
              courseName: i.courseName.trim(),
              allocation: i.allocation ? i.allocation.trim() : null,
              hours: Number(i.hours),
            })),
        },
        responsibilities: (formData.responsibilities || [])
          .filter((r) => r.role && r.role.trim())
          .map((r) => ({
            role: r.role.trim(),
            allocation: r.allocation ? r.allocation.trim() : null,
            hours: Number(r.hours),
          })),
      };

      const result = await createFaculty(payload);

      showToast(`Faculty '${formData.facultyName}' created successfully!`, 'success');
      setCreatedResult(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('[AddFaculty] Submission error:', err);

      let msg = err.message || 'An unexpected error occurred while saving faculty.';
      if (err.status === 400) {
        msg = err.message || 'Validation failed. Please verify all inputs and constraints.';
      } else if (err.status === 401) {
        msg = 'Your session has expired. Please sign in again.';
      } else if (err.status === 403) {
        msg = 'Access denied: You lack statutory authorization to add faculty members.';
      } else if (err.status === 409) {
        msg = err.message || 'A faculty record with this identity or ID already exists.';
      } else if (err.status >= 500) {
        msg = 'Server encountered an internal error. Please try again later.';
      }

      setServerError(msg);
      showToast(msg, 'error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM_STATE);
    setErrors({});
    setServerError(null);
    setCreatedResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If successfully created, display authoritative summary screen
  if (createdResult) {
    return (
      <div>
        <PageHeader
          title="Faculty Created Successfully"
          description="Authoritative workload calculation verified and committed to institutional register."
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: 'HOD Portal', path: '/hod/dashboard' },
                { label: 'Faculty Directory', path: '/hod/faculty' },
                { label: 'Add Faculty Result' },
              ]}
            />
          }
          badge={<Badge variant="success">201 CREATED • AUTHORITATIVE</Badge>}
        />
        <SuccessWorkloadSummary
          result={createdResult}
          onReset={handleReset}
          onViewList={() => navigate('/hod/faculty')}
        />
      </div>
    );
  }

  const selectedRoles = formData.responsibilities
    .map((r) => (r.role ? r.role.toLowerCase().trim() : ''))
    .filter(Boolean);

  return (
    <div>
      <PageHeader
        title="Add New CSE Faculty & Workload Allocation"
        description="Comprehensive profile registration and institutional contact hour distribution for Computer Science & Engineering faculty."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'HOD Portal', path: '/hod/dashboard' },
              { label: 'Faculty Directory', path: '/hod/faculty' },
              { label: 'Add New Faculty' },
            ]}
          />
        }
        badge={<Badge variant="warning">HOD / ADMIN STATUTORY WORKFLOW</Badge>}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/hod/faculty')} icon="«">
            Cancel & Return
          </Button>
        }
      />

      {/* Global Server Error Banner */}
      {serverError && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--color-error-container)',
            color: 'var(--color-on-error-container)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #ffb4ab',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Section 1: Faculty Information */}
        <FacultyBasicInfoForm
          formData={formData}
          onChange={handleBasicInfoChange}
          errors={errors}
        />

        {/* Section 2: UG Theory (Theory 1 & Theory 2) */}
        <Card
          title="2. UG Theory Allocations"
          action={<Badge variant="theory">Contact Periods</Badge>}
          style={{ marginBottom: '24px' }}
        >
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Assign theory subjects across separate curriculum blocks (UG Theory 1 and UG Theory 2). Each course represents weekly theory contact periods.
          </p>

          {/* Block 2A: UG Theory 1 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                UG Theory 1
              </h4>
              <Button variant="outline" size="sm" onClick={() => addTheoryRow('ugTheory1')} icon="➕">
                Add Subject
              </Button>
            </div>
            {formData.teaching.ugTheory1.map((item, idx) => (
              <TheoryAllocationRow
                key={idx}
                item={item}
                index={idx}
                onChange={(index, updated) => updateRow('ugTheory1', index, updated)}
                onRemove={(index) => removeRow('ugTheory1', index)}
                isRemovable={formData.teaching.ugTheory1.length > 1}
                error={{
                  courseName: errors[`ugTheory1_${idx}_courseName`],
                  hours: errors[`ugTheory1_${idx}_hours`],
                }}
              />
            ))}
          </div>

          {/* Block 2B: UG Theory 2 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                UG Theory 2
              </h4>
              <Button variant="outline" size="sm" onClick={() => addTheoryRow('ugTheory2')} icon="➕">
                Add Subject
              </Button>
            </div>
            {formData.teaching.ugTheory2.map((item, idx) => (
              <TheoryAllocationRow
                key={idx}
                item={item}
                index={idx}
                onChange={(index, updated) => updateRow('ugTheory2', index, updated)}
                onRemove={(index) => removeRow('ugTheory2', index)}
                isRemovable={formData.teaching.ugTheory2.length > 1}
                error={{
                  courseName: errors[`ugTheory2_${idx}_courseName`],
                  hours: errors[`ugTheory2_${idx}_hours`],
                }}
              />
            ))}
          </div>
        </Card>

        {/* Section 3: Laboratory Allocation (Lab 1 & Lab 2) */}
        <Card
          title="3. Laboratory Allocations"
          action={<Badge variant="lab">Practical Periods</Badge>}
          style={{ marginBottom: '24px' }}
        >
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Assign practical laboratory sessions separately under Lab 1 and Lab 2. Do not merge laboratory blocks.
          </p>

          {/* Block 3A: Lab 1 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-tertiary-container)' }}>
                Lab 1
              </h4>
              <Button variant="outline" size="sm" onClick={() => addLabRow('lab1')} icon="➕">
                Add Lab
              </Button>
            </div>
            {formData.teaching.lab1.map((item, idx) => (
              <LabAllocationRow
                key={idx}
                item={item}
                index={idx}
                onChange={(index, updated) => updateRow('lab1', index, updated)}
                onRemove={(index) => removeRow('lab1', index)}
                isRemovable={formData.teaching.lab1.length > 1}
                error={{
                  courseName: errors[`lab1_${idx}_courseName`],
                  hours: errors[`lab1_${idx}_hours`],
                }}
              />
            ))}
          </div>

          {/* Block 3B: Lab 2 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-tertiary-container)' }}>
                Lab 2
              </h4>
              <Button variant="outline" size="sm" onClick={() => addLabRow('lab2')} icon="➕">
                Add Lab
              </Button>
            </div>
            {formData.teaching.lab2.map((item, idx) => (
              <LabAllocationRow
                key={idx}
                item={item}
                index={idx}
                onChange={(index, updated) => updateRow('lab2', index, updated)}
                onRemove={(index) => removeRow('lab2', index)}
                isRemovable={formData.teaching.lab2.length > 1}
                error={{
                  courseName: errors[`lab2_${idx}_courseName`],
                  hours: errors[`lab2_${idx}_hours`],
                }}
              />
            ))}
          </div>
        </Card>

        {/* Section 4: PG / Honours / Minor */}
        <Card
          title="4. PG / Honours / Minor Allocations"
          action={<Badge variant="secondary">1 Course = 1 Hour Rule</Badge>}
          style={{ marginBottom: '24px' }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-container-low)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-surface-container-high)',
              marginBottom: '16px',
              fontSize: '0.8125rem',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <strong>Statutory Load Computation Rule:</strong> Under Autonomous R2022 norms, each assigned PG, Honours, or Minor course contributes exactly <strong>1 equivalent contact hour/week</strong> towards the teaching workload. Arbitrary hourly overrides are prohibited.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Assigned PG / Specialized Courses</span>
            <Button variant="outline" size="sm" onClick={addPGRow} icon="➕">
              Add PG Course
            </Button>
          </div>

          {formData.teaching.pg.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic', fontSize: '0.875rem' }}>
              No PG / Honours / Minor courses currently assigned. Click "Add PG Course" to assign one.
            </div>
          ) : (
            formData.teaching.pg.map((item, idx) => (
              <PGAllocationRow
                key={idx}
                item={item}
                index={idx}
                onChange={(index, updated) => updateRow('pg', index, updated)}
                onRemove={(index) => removeRow('pg', index)}
                isRemovable={true}
                error={{
                  courseName: errors[`pg_${idx}_courseName`],
                }}
              />
            ))
          )}
        </Card>

        {/* Section 5: Others */}
        <Card
          title="5. Other Academic Allocations"
          action={<Badge variant="neutral">Limit: 1–3 Hours</Badge>}
          style={{ marginBottom: '24px' }}
        >
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Project-based learning, mini projects, specialized tutorials, or seminar sessions. Contact hours are strictly constrained between <strong>1 and 3 hours/week</strong>.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Other Academic Activities</span>
            <Button variant="outline" size="sm" onClick={addOthersRow} icon="➕">
              Add Activity
            </Button>
          </div>

          {formData.teaching.others.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic', fontSize: '0.875rem' }}>
              No other academic activities assigned. Click "Add Activity" to assign one.
            </div>
          ) : (
            formData.teaching.others.map((item, idx) => (
              <OtherAllocationRow
                key={idx}
                item={item}
                index={idx}
                onChange={(index, updated) => updateRow('others', index, updated)}
                onRemove={(index) => removeRow('others', index)}
                isRemovable={true}
                error={{
                  courseName: errors[`others_${idx}_courseName`],
                  hours: errors[`others_${idx}_hours`],
                }}
              />
            ))
          )}
        </Card>

        {/* Section 6: Other Responsibilities */}
        <Card
          title="6. Institutional Responsibilities"
          action={<Badge variant="warning">38 Authoritative Master Roles</Badge>}
          style={{ marginBottom: '24px' }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-container-low)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-surface-container-high)',
              marginBottom: '16px',
              fontSize: '0.8125rem',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <strong>Role Validation Rules:</strong> Sourced strictly from the 38-role institutional master (e.g., <em>Class Advisor, Proctor, DCOE, TECH GURU, CC1 Lab Incharge</em>). Hours must be between <strong>1 and 6 hours/week</strong>. Duplicate roles for the same faculty member are strictly prevented.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Designated Institutional Duties</span>
            <Button variant="outline" size="sm" onClick={addResponsibilityRow} icon="➕">
              Add Responsibility
            </Button>
          </div>

          {formData.responsibilities.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-outline)', fontStyle: 'italic', fontSize: '0.875rem' }}>
              No institutional responsibilities assigned. Click "Add Responsibility" to assign one.
            </div>
          ) : (
            formData.responsibilities.map((item, idx) => (
              <ResponsibilityRow
                key={idx}
                item={item}
                index={idx}
                onChange={updateResponsibilityRow}
                onRemove={removeResponsibilityRow}
                selectedRoles={selectedRoles}
                isRemovable={formData.responsibilities.length > 1}
                error={{
                  role: errors[`resp_${idx}_role`],
                  hours: errors[`resp_${idx}_hours`],
                }}
              />
            ))
          )}
        </Card>

        {/* Section 7: Workload Summary (Estimated Live UI) */}
        <WorkloadSummary
          teaching={formData.teaching}
          responsibilities={formData.responsibilities}
        />

        {/* Section 8: Review & Save */}
        <Card title="8. Review & Save Workload Allocation" style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--color-on-surface)' }}>
                Commit Faculty Profile & Allocation
              </h4>
              <p className="text-muted text-sm" style={{ margin: 0 }}>
                Upon clicking "Create Faculty", the backend will validate the structured allocations, compute authoritative totals, and return the certified workload.
              </p>
            </div>

            <div className="ui-add-faculty-action-group">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/hod/faculty')}
                disabled={isSubmitting}
              >
                Discard & Return
              </Button>

              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                icon="💾"
              >
                Create Faculty & Allocate
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
