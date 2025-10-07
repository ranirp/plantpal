/**
 * @fileoverview Client-side JavaScript for the Add Plant form.
 * Handles image preview, form validation, and submission to the API.
 */

const descriptionField = document.getElementById('description');
const charCount = document.getElementById('charCount');

descriptionField.addEventListener('input', function() {
    charCount.textContent = this.value.length;

    // Change color as approaching limit
    if (this.value.length > 450) {
        charCount.classList.add('text-danger');
    } else if (this.value.length > 400) {
        charCount.classList.remove('text-danger');
        charCount.classList.add('text-warning');
    } else {
        charCount.classList.remove('text-warning', 'text-danger');
    }
});

// Image preview functionality
const photoInput = document.getElementById('photo');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');

photoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];

    if (file) {
        //Validate file size (Max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            photoInput.value = ''; // Clear the input
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            photoInput.value = ''; // Clear the input
            return;
        }

        // Show image preview
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePreviewContainer.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
    }
});

// Clear image preview
function clearImagePreview() {
    photoInput.value = '';
    imagePreview.src = '#';
    imagePreviewContainer.classList.add('d-none');
}

// Form submission with validation and feedback
const form = document.getElementById('addPlantForm');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // Basic client-side validation
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
    }

    // Show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Sharing...`;

    try {
        const formData = new FormData(form);

        const response = await fetch('/api/plants', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();

            // Show success message and redirect
            alert('Plant shared successfully!');
            window.location.href = '/';
        } else {
            const error = await response.json();
            alert('Error: ' + (error.message || 'Failed to share plant'));

            // Reset button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        alert('An unexpected error occurred. Please try again.');

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Auto-save form data to prevent data loss (optional enhancement)
const formFields = ['plantName', 'type', 'description', 'nickname'];

// Load saved data on page load
window.addEventListener('DOMContentLoaded', function() {
    formFields.forEach(field => {
        const savedValue = localStorage.getItem('plantForm_' + field);
        if (savedValue && document.getElementById(field)) {   
            document.getElementById(field).value = savedValue;
        }
    });
});

// Save form data to localStorage on input change
formFields.forEach(field => {
    const element = document.getElementById(field);
    if (element) {
        element.addEventListener('input', function() {
            localStorage.setItem('plantForm_' + field, this.value);
        });
    }
});

// Clear saved data on successful submission
form.addEventListener('submit', function() {
    formFields.forEach(field => {
        localStorage.removeItem('plantForm_' + field);
    });
});

// Add type icons dynamically based on selection
document.getElementById('type').addEventListener('change', function() {
    const icons = {
        'Succulent': 'bi-flower3',
        'Fern': 'bi-tree',
        'houseplant': 'bi-house',
        'vegetable': 'bi-basket',
        'herb': 'bi-leaf',
        'flowering': 'bi-flower1',
        'other': 'bi-question-circle'
    };

    const icon = icons[this.value];
    if (icon) {
        this.style.backgroundImage = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' class='${icon}'><use href='#${icon}'/></svg>")`;
    }
});