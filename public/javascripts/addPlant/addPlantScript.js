/**
 * @fileoverview Client-side JavaScript for the Add Plant form.
 * Handles image preview, form validation, and submission to the API.
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('plantForm');
    const photoInput = document.getElementById('photoID');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const submitBtn = document.getElementById('submitBtn');
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));

    // Image preview functionality
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showError('Please select a valid image file.');
                photoInput.value = '';
                imagePreviewContainer.style.display = 'none';
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showError('Image file size must be less than 5MB.');
                photoInput.value = '';
                imagePreviewContainer.style.display = 'none';
                return;
            }

            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreviewContainer.style.display = 'block';
                
                // Smooth scroll to preview
                setTimeout(() => {
                    imagePreviewContainer.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                    });
                }, 100);
            };
            reader.readAsDataURL(file);
        } else {
            imagePreviewContainer.style.display = 'none';
        }
    });

    // Form validation
    function validateForm() {
        let isValid = true;
        const requiredFields = ['plantName', 'type', 'description', 'nickname'];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            const value = field.value.trim();
            
            if (!value) {
                field.classList.add('is-invalid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
                field.classList.add('is-valid');
            }
        });

        // Validate description length
        const description = document.getElementById('description');
        if (description.value.trim().length < 10) {
            description.classList.add('is-invalid');
            showError('Description must be at least 10 characters long.');
            isValid = false;
        }

        // Validate plant name length
        const plantName = document.getElementById('plantName');
        if (plantName.value.trim().length < 2) {
            plantName.classList.add('is-invalid');
            showError('Plant name must be at least 2 characters long.');
            isValid = false;
        }

        return isValid;
    }

    // Real-time validation
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            showError('Please fill in all required fields correctly.');
            return;
        }

        // Show loading modal
        loadingModal.show();
        submitBtn.disabled = true;

        try {
            const formData = new FormData(form);
            
            const response = await fetch('/api/plants', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                // Success
                loadingModal.hide();
                setTimeout(() => {
                    successModal.show();
                }, 300);
                
                // Reset form
                form.reset();
                imagePreviewContainer.style.display = 'none';
                inputs.forEach(input => {
                    input.classList.remove('is-valid', 'is-invalid');
                });
                
            } else {
                throw new Error(result.message || 'Failed to add plant');
            }

        } catch (error) {
            console.error('Error submitting form:', error);
            loadingModal.hide();
            showError('Error adding plant: ' + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Error handling
    function showError(message) {
        // Remove existing alerts
        const existingAlert = document.querySelector('.alert-danger');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create new alert
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show';
        alert.innerHTML = `
            <i class="bi bi-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert at top of form
        const cardBody = document.querySelector('.card-body');
        cardBody.insertBefore(alert, form);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    // Character counters for text inputs
    const textareaFields = document.querySelectorAll('textarea');
    textareaFields.forEach(textarea => {
        const maxLength = textarea.getAttribute('maxlength') || 500;
        
        // Create counter element
        const counter = document.createElement('div');
        counter.className = 'form-text text-muted small';
        counter.style.textAlign = 'right';
        textarea.parentNode.appendChild(counter);
        
        function updateCounter() {
            const remaining = maxLength - textarea.value.length;
            counter.textContent = `${textarea.value.length}/${maxLength} characters`;
            
            if (remaining < 50) {
                counter.className = 'form-text text-warning small';
            } else {
                counter.className = 'form-text text-muted small';
            }
        }
        
        textarea.addEventListener('input', updateCounter);
        updateCounter(); // Initial call
    });

    // Auto-resize textarea
    const description = document.getElementById('description');
    description.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
});

// Utility function to handle browser back button
window.addEventListener('beforeunload', function(e) {
    const form = document.getElementById('plantForm');
    const formData = new FormData(form);
    let hasData = false;
    
    for (let [key, value] of formData.entries()) {
        if (value && key !== 'photo') {
            hasData = true;
            break;
        }
    }
    
    if (hasData) {
        e.preventDefault();
        e.returnValue = '';
    }
});