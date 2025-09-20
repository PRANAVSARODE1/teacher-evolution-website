// Teacher Interview Portal - JavaScript Functionality

class TeacherInterviewApp {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.formData = {};
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.updateProgress();
        this.validateCurrentStep();
    }

    bindEvents() {
        // Navigation buttons
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevStep());
        document.getElementById('submitBtn').addEventListener('click', (e) => this.submitForm(e));
        
        // Form validation on input change
        const form = document.getElementById('interviewForm');
        form.addEventListener('input', () => this.validateCurrentStep());
        form.addEventListener('change', () => this.validateCurrentStep());
        
        // Real-time validation for required fields
        this.setupRealTimeValidation();
    }

    setupRealTimeValidation() {
        const requiredFields = document.querySelectorAll('input[required], select[required], textarea[required]');
        
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => this.validateField(field));
        });
    }

    validateField(field) {
        const isValid = field.checkValidity();
        const formGroup = field.closest('.form-group');
        
        if (isValid) {
            field.style.borderColor = '#10b981';
            this.removeErrorMessage(formGroup);
        } else {
            field.style.borderColor = '#ef4444';
            this.showFieldError(formGroup, field.validationMessage);
        }
        
        return isValid;
    }

    showFieldError(formGroup, message) {
        this.removeErrorMessage(formGroup);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = '#ef4444';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '5px';
        errorDiv.textContent = message;
        
        formGroup.appendChild(errorDiv);
    }

    removeErrorMessage(formGroup) {
        const existingError = formGroup.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    validateCurrentStep() {
        const currentStepElement = document.getElementById(`step${this.currentStep}`);
        const requiredFields = currentStepElement.querySelectorAll('input[required], select[required], textarea[required]');
        const checkboxGroups = currentStepElement.querySelectorAll('.checkbox-group');
        
        let isValid = true;
        
        // Validate required text/select/textarea fields
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        // Validate checkbox groups (at least one must be selected)
        checkboxGroups.forEach(group => {
            const checkboxes = group.querySelectorAll('input[type="checkbox"]');
            const hasSelection = Array.from(checkboxes).some(cb => cb.checked);
            
            if (!hasSelection) {
                isValid = false;
                this.showFieldError(group.closest('.form-group'), 'Please select at least one option');
            } else {
                this.removeErrorMessage(group.closest('.form-group'));
            }
        });
        
        // Update next/submit button state
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        if (this.currentStep === this.totalSteps) {
            submitBtn.style.display = isValid ? 'block' : 'none';
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = isValid ? 'block' : 'none';
            submitBtn.style.display = 'none';
        }
        
        return isValid;
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            this.saveCurrentStepData();
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.validateCurrentStep();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.saveCurrentStepData();
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.validateCurrentStep();
        }
    }

    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show current step
        document.getElementById(`step${stepNumber}`).classList.add('active');
        
        // Update navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        prevBtn.style.display = stepNumber > 1 ? 'block' : 'none';
    }

    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        const progressPercentage = (this.currentStep / this.totalSteps) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        progressText.textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
    }

    saveCurrentStepData() {
        const currentStepElement = document.getElementById(`step${this.currentStep}`);
        const formData = new FormData(currentStepElement);
        
        // Convert FormData to regular object
        for (let [key, value] of formData.entries()) {
            if (this.formData[key]) {
                // Handle multiple values (like checkboxes)
                if (Array.isArray(this.formData[key])) {
                    this.formData[key].push(value);
                } else {
                    this.formData[key] = [this.formData[key], value];
                }
            } else {
                this.formData[key] = value;
            }
        }
    }

    async submitForm(e) {
        e.preventDefault();
        
        if (!this.validateCurrentStep()) {
            return;
        }
        
        this.saveCurrentStepData();
        
        // Show loading state
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;
        
        try {
            // Simulate API call
            await this.simulateSubmission();
            
            // Show success message
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Submission error:', error);
            alert('There was an error submitting your application. Please try again.');
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    simulateSubmission() {
        return new Promise((resolve) => {
            // Simulate network delay
            setTimeout(() => {
                console.log('Form submitted with data:', this.formData);
                resolve();
            }, 2000);
        });
    }

    showSuccessMessage() {
        // Hide form
        document.getElementById('interviewForm').style.display = 'none';
        document.querySelector('.progress-container').style.display = 'none';
        
        // Show success message
        document.getElementById('successMessage').style.display = 'block';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Utility method to get form data (for debugging or external use)
    getFormData() {
        this.saveCurrentStepData();
        return this.formData;
    }
}

// Additional utility functions
function formatPhoneNumber(input) {
    // Remove all non-numeric characters
    let value = input.value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (value.length >= 6) {
        value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
    } else if (value.length >= 3) {
        value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    }
    
    input.value = value;
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the main application
    window.teacherInterviewApp = new TeacherInterviewApp();
    
    // Add phone number formatting
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => formatPhoneNumber(phoneInput));
    }
    
    // Add smooth scrolling for better UX
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add keyboard navigation support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const nextBtn = document.getElementById('nextBtn');
            const submitBtn = document.getElementById('submitBtn');
            
            if (nextBtn.style.display !== 'none') {
                nextBtn.click();
            } else if (submitBtn.style.display !== 'none') {
                submitBtn.click();
            }
        }
    });
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeacherInterviewApp;
}
