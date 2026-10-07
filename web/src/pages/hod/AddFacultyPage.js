import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Breadcrumbs from '../../components/layout/Breadcrumbs';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useToast } from '../../context/ToastContext';
import { createFaculty } from '../../services/facultyService';

// Subcomponents
import FacultyBasicInfoForm from '../../components/faculty/FacultyBasicInfoForm';

const INITIAL_FORM_STATE = {
  facultyName: '',
  title: '',
  department: 'Department of Computer Science and Engineering',
  email: '',
  phone: '',
  dob: '',
  designation: 'Assistant Professor',
};

export default function AddFacultyPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);

  const handleBasicInfoChange = (newInfo) => {
    setFormData((prev) => ({
      ...prev,
      facultyName: newInfo.facultyName,
      title: newInfo.title,
      designation: newInfo.designation,
      department: newInfo.department,
      email: newInfo.email,
      phone: newInfo.phone,
      dob: newInfo.dob,
    }));
    if (errors.facultyName || errors.title || errors.designation || errors.email) {
      setErrors((prev) => ({ ...prev, facultyName: null, title: null, designation: null, email: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const errorList = [];

    if (!formData.facultyName || !formData.facultyName.trim()) {
      newErrors.facultyName = 'Faculty Name is required';
      errorList.push('Faculty Name is required');
    }
    if (!formData.title || !formData.title.trim()) {
      newErrors.title = 'Title is required';
      errorList.push('Title is required');
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Invalid email address format';
        errorList.push('Invalid email address format');
      }
    }

    setErrors(newErrors);
    return { isValid: errorList.length === 0, errorList };
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
      window.scrollTo({ top: 150, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        facultyName: formData.facultyName.trim(),
        title: formData.title.trim(),
        designation: formData.designation ? formData.designation.trim() : '',
        department: formData.department.trim(),
        email: formData.email && formData.email.trim() ? formData.email.trim() : undefined,
        phone: formData.phone && formData.phone.trim() ? formData.phone.trim() : undefined,
        roles: ['FACULTY'],
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

  // If successfully created, display success screen
  if (createdResult) {
    return (
      <div>
        <PageHeader
          title="Faculty Created Successfully"
          description="Faculty identity record has been created and committed to the institutional register."
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: 'HOD Portal', path: '/hod/dashboard' },
                { label: 'Faculty Directory', path: '/hod/faculty' },
                { label: 'Add Faculty Result' },
              ]}
            />
          }
          badge={<Badge variant="success">201 CREATED</Badge>}
        />
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h3 style={{ marginBottom: '8px' }}>Faculty Record Created</h3>
          <p className="text-muted" style={{ marginBottom: '24px' }}>
            {createdResult.facultyName || formData.facultyName} has been successfully registered.
            The institutional Faculty ID will be assigned by the backend system.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Button variant="outline" size="md" onClick={handleReset}>
              Add Another Faculty
            </Button>
            <Button variant="primary" size="md" onClick={() => navigate('/hod/faculty')}>
              View Faculty Directory
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Add New Faculty"
        description="Register a new faculty member profile for Computer Science & Engineering department."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'HOD Portal', path: '/hod/dashboard' },
              { label: 'Faculty Directory', path: '/hod/faculty' },
              { label: 'Add New Faculty' },
            ]}
          />
        }
        badge={<Badge variant="warning">HOD / ADMIN WORKFLOW</Badge>}
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
        {/* Section 1: Faculty Identity */}
        <FacultyBasicInfoForm
          formData={formData}
          onChange={handleBasicInfoChange}
          errors={errors}
        />

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
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
            Create Faculty
          </Button>
        </div>
      </form>
    </div>
  );
}
