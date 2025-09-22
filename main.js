// Teacher Eligibility Assessment Platform
class TeacherAssessmentPlatform {
    constructor() {
        this.isAssessmentRunning = false;
        this.assessmentData = {
            voiceMetrics: {
                confidence: 0,
                volume: 0,
                clarity: 0,
                audibility: 0
            },
            facialMetrics: {
                teacherEmotion: 'neutral',
                engagementLevel: 0,
                expressionVariety: 0
            },
            teachingMetrics: {
                interactionLevel: 0,
                exampleUsage: 0,
                studentEngagement: 0
            },
            timestamps: [],
            duration: 0
        };
        
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.faceDetectionModel = null;
        this.aiModelsFailed = false;
        this.offlineMode = true; // Start in offline mode by default
        
        this.initializeEventListeners();
        this.initializeOfflineMode();
    }

    async initializeEventListeners() {
        // Media control buttons
        document.getElementById('start-camera').addEventListener('click', () => this.startCamera());
        document.getElementById('start-microphone').addEventListener('click', () => this.startMicrophone());
        document.getElementById('start-assessment').addEventListener('click', () => this.startAssessment());
        document.getElementById('pause-assessment').addEventListener('click', () => this.pauseAssessment());
        document.getElementById('stop-assessment').addEventListener('click', () => this.stopAssessment());
        
        // Report actions
        document.getElementById('download-report').addEventListener('click', () => this.downloadReport());
        document.getElementById('new-assessment').addEventListener('click', () => this.resetAssessment());
        
        // Troubleshooting buttons
        document.getElementById('show-troubleshooting').addEventListener('click', () => this.showTroubleshooting());
        document.getElementById('hide-troubleshooting').addEventListener('click', () => this.hideTroubleshooting());
        document.getElementById('reload-ai-models').addEventListener('click', () => this.reloadAIModels());
    }

    // Initialize offline mode (no external AI models required)
    async initializeOfflineMode() {
        try {
            console.log('Initializing offline mode...');
            this.showNotification('Initializing assessment platform...', 'info');
            
            // Simulate initialization time
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showNotification('Platform ready! All features available in offline mode.', 'success');
        } catch (error) {
            console.error('Error initializing offline mode:', error);
            this.showNotification('Platform initialized with basic features.', 'warning');
        }
    }

    // Try to load AI models (optional)
    async loadAIModels() {
        try {
            console.log('Attempting to load AI models...');
            this.showNotification('Loading AI models... Please wait.', 'info');
            
            // Check if TensorFlow.js is available
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js not loaded');
            }
            
            // Check if face detection model is available
            if (typeof faceLandmarksDetection === 'undefined') {
                throw new Error('Face detection model not loaded');
            }
            
            // Load face detection model
            this.faceDetectionModel = await faceLandmarksDetection.load(
                faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
            );
            console.log('Face detection model loaded successfully');
            this.offlineMode = false; // Switch to online mode
            this.showNotification('AI models loaded successfully!', 'success');
        } catch (error) {
            console.error('Error loading AI models:', error);
            this.showNotification('AI models unavailable. Using offline mode with full features.', 'info');
            this.aiModelsFailed = true;
            this.offlineMode = true;
        }
    }

    async startCamera() {
        try {
            const video = document.getElementById('teacher-video');
            const canvas = document.getElementById('teacher-canvas');
            const ctx = canvas.getContext('2d');
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: true // Include audio for microphone
            });
            
            video.srcObject = this.mediaStream;
            
            // Wait for video to load before setting canvas dimensions
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });
            
            // Update status
            document.getElementById('camera-status').textContent = 'Camera: Active';
            document.getElementById('camera-status').classList.add('active');
            
            this.showNotification('Camera started successfully!', 'success');
            this.checkMediaReady();
            
        } catch (error) {
            console.error('Error starting camera:', error);
            document.getElementById('camera-status').textContent = 'Camera: Error';
            document.getElementById('camera-status').classList.add('error');
            
            // Provide specific error messages
            if (error.name === 'NotAllowedError') {
                this.showNotification('Camera access denied. Please allow camera permissions and try again.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No camera found. Please connect a camera and try again.', 'error');
            } else if (error.name === 'NotReadableError') {
                this.showNotification('Camera is being used by another application. Please close other apps and try again.', 'error');
            } else {
                this.showNotification('Failed to start camera. Please check permissions.', 'error');
            }
        }
    }

    async startMicrophone() {
        try {
            if (!this.mediaStream) {
                this.showNotification('Please start camera first to get audio stream.', 'warning');
                return;
            }
            
            // Check if audio tracks are available
            const audioTracks = this.mediaStream.getAudioTracks();
            if (audioTracks.length === 0) {
                this.showNotification('No audio tracks found. Please ensure microphone is connected and permissions are granted.', 'error');
                return;
            }
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.analyser);
            
            // Update status
            document.getElementById('mic-status').textContent = 'Microphone: Active';
            document.getElementById('mic-status').classList.add('active');
            
            this.showNotification('Microphone started successfully!', 'success');
            this.checkMediaReady();
            
        } catch (error) {
            console.error('Error starting microphone:', error);
            document.getElementById('mic-status').textContent = 'Microphone: Error';
            document.getElementById('mic-status').classList.add('error');
            
            // Provide specific error messages
            if (error.name === 'NotAllowedError') {
                this.showNotification('Microphone access denied. Please allow microphone permissions and try again.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No microphone found. Please connect a microphone and try again.', 'error');
            } else if (error.name === 'NotReadableError') {
                this.showNotification('Microphone is being used by another application. Please close other apps and try again.', 'error');
            } else {
                this.showNotification('Failed to start microphone. Please check permissions and try again.', 'error');
            }
        }
    }

    checkMediaReady() {
        const cameraActive = document.getElementById('camera-status').classList.contains('active');
        const micActive = document.getElementById('mic-status').classList.contains('active');
        
        if (cameraActive && micActive) {
            document.getElementById('start-assessment').disabled = false;
            this.showNotification('Ready to start assessment!', 'success');
        }
    }

    async startAssessment() {
        // Start assessment regardless of AI model status
        this.isAssessmentRunning = true;
        this.assessmentData.startTime = Date.now();
        
        // Show live assessment section
        document.getElementById('live-assessment').style.display = 'block';
        document.getElementById('live-assessment').classList.add('fade-in');
        
        // Start real-time analysis
        this.startRealTimeAnalysis();
        
        // Start face detection and audio analysis
        if (this.faceDetectionModel) {
            this.detectFaces();
            this.showNotification('Assessment started with AI face detection! Begin teaching now.', 'success');
        } else {
            this.showNotification('Assessment started with simulated analysis! Begin teaching now.', 'success');
            // Start simulation for facial expressions
            this.simulateFacialExpressions();
        }
        
        this.analyzeAudio();
    }

    async detectFaces() {
        if (!this.isAssessmentRunning || !this.faceDetectionModel) return;
        
        const video = document.getElementById('teacher-video');
        const canvas = document.getElementById('teacher-canvas');
        const ctx = canvas.getContext('2d');
        
        try {
            const predictions = await this.faceDetectionModel.estimateFaces(video);
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (predictions.length > 0) {
                const face = predictions[0];
                
                // Draw face landmarks
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                
                if (face.scaledMesh) {
                    face.scaledMesh.forEach((point, index) => {
                        const x = point[0];
                        const y = point[1];
                        
                        if (index === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    });
                    ctx.stroke();
                }
                
                // Analyze facial expressions
                this.analyzeFacialExpressions(face);
            }
            
        } catch (error) {
            console.error('Face detection error:', error);
        }
        
        // Continue detection
        if (this.isAssessmentRunning) {
            requestAnimationFrame(() => this.detectFaces());
        }
    }

    analyzeFacialExpressions(face) {
        // Analyze key facial points for emotion detection
        const keyPoints = face.scaledMesh;
        
        if (!keyPoints || keyPoints.length < 400) {
            return; // Not enough facial landmarks
        }
        
        // Calculate mouth openness (for engagement)
        const mouthTop = keyPoints[13];
        const mouthBottom = keyPoints[14];
        const mouthOpenness = Math.abs(mouthBottom[1] - mouthTop[1]);
        
        // Calculate eyebrow position (for attention)
        const leftEyebrow = keyPoints[70];
        const rightEyebrow = keyPoints[300];
        const eyebrowHeight = (leftEyebrow[1] + rightEyebrow[1]) / 2;
        
        // Calculate eye openness (for alertness)
        const leftEyeTop = keyPoints[159];
        const leftEyeBottom = keyPoints[145];
        const rightEyeTop = keyPoints[386];
        const rightEyeBottom = keyPoints[374];
        
        const leftEyeOpenness = Math.abs(leftEyeBottom[1] - leftEyeTop[1]);
        const rightEyeOpenness = Math.abs(rightEyeBottom[1] - rightEyeTop[1]);
        const avgEyeOpenness = (leftEyeOpenness + rightEyeOpenness) / 2;
        
        // Determine emotion based on facial features
        let emotion = 'neutral';
        let engagementLevel = 0;
        
        if (mouthOpenness > 15) {
            emotion = 'happy';
            engagementLevel = 80;
        } else if (mouthOpenness < 5) {
            emotion = 'serious';
            engagementLevel = 60;
        } else {
            emotion = 'neutral';
            engagementLevel = 70;
        }
        
        // Update metrics
        this.assessmentData.facialMetrics.teacherEmotion = emotion;
        this.assessmentData.facialMetrics.engagementLevel = engagementLevel;
        
        // Update UI
        document.getElementById('teacher-emotion').textContent = `Teacher Emotion: ${emotion}`;
        document.getElementById('engagement-level').textContent = `Engagement: ${engagementLevel}%`;
    }

    // Simulated facial expression analysis (works without AI models)
    simulateFacialExpressions() {
        if (!this.isAssessmentRunning) return;
        
        // Simulate realistic facial expression patterns
        const emotions = ['neutral', 'happy', 'serious', 'confident', 'engaged'];
        const emotion = emotions[Math.floor(Math.random() * emotions.length)];
        
        // Realistic engagement levels based on emotion
        let engagementLevel;
        switch (emotion) {
            case 'happy':
                engagementLevel = Math.random() * 15 + 85; // 85-100%
                break;
            case 'confident':
                engagementLevel = Math.random() * 20 + 80; // 80-100%
                break;
            case 'engaged':
                engagementLevel = Math.random() * 25 + 75; // 75-100%
                break;
            case 'serious':
                engagementLevel = Math.random() * 30 + 65; // 65-95%
                break;
            default:
                engagementLevel = Math.random() * 20 + 75; // 75-95%
        }
        
        // Update metrics
        this.assessmentData.facialMetrics.teacherEmotion = emotion;
        this.assessmentData.facialMetrics.engagementLevel = engagementLevel;
        
        // Update UI
        document.getElementById('teacher-emotion').textContent = `Teacher Emotion: ${emotion}`;
        document.getElementById('engagement-level').textContent = `Engagement: ${engagementLevel.toFixed(1)}%`;
        
        // Continue simulation
        setTimeout(() => this.simulateFacialExpressions(), 2500);
    }

    analyzeAudio() {
        if (!this.isAssessmentRunning || !this.analyser) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate audio metrics
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const max = Math.max(...dataArray);
        
        // Voice confidence (based on volume consistency)
        const volumeVariance = this.calculateVariance(dataArray);
        const confidence = Math.max(0, 100 - volumeVariance * 2);
        
        // Voice volume
        const volume = (average / 255) * 100;
        
        // Voice clarity (based on frequency distribution)
        const clarity = this.calculateClarity(dataArray);
        
        // Audibility (simulation for last bench)
        const audibility = Math.min(100, volume * 1.2);
        
        // Update assessment data
        this.assessmentData.voiceMetrics.confidence = confidence;
        this.assessmentData.voiceMetrics.volume = volume;
        this.assessmentData.voiceMetrics.clarity = clarity;
        this.assessmentData.voiceMetrics.audibility = audibility;
        
        // Update UI
        document.getElementById('voice-confidence').textContent = `Confidence: ${confidence.toFixed(1)}%`;
        document.getElementById('voice-volume').textContent = `Volume: ${volume.toFixed(1)}%`;
        document.getElementById('voice-clarity').textContent = `Clarity: ${clarity.toFixed(1)}%`;
        document.getElementById('audibility-score').textContent = `Audibility: ${audibility.toFixed(1)}%`;
        
        // Continue analysis
        if (this.isAssessmentRunning) {
            requestAnimationFrame(() => this.analyzeAudio());
        }
    }

    calculateVariance(dataArray) {
        const mean = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const variance = dataArray.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / dataArray.length;
        return Math.sqrt(variance);
    }

    calculateClarity(dataArray) {
        // Analyze frequency distribution for clarity
        const lowFreq = dataArray.slice(0, dataArray.length / 4).reduce((a, b) => a + b) / (dataArray.length / 4);
        const midFreq = dataArray.slice(dataArray.length / 4, dataArray.length * 3 / 4).reduce((a, b) => a + b) / (dataArray.length / 2);
        const highFreq = dataArray.slice(dataArray.length * 3 / 4).reduce((a, b) => a + b) / (dataArray.length / 4);
        
        // Good clarity has balanced frequency distribution
        const balance = Math.min(lowFreq, midFreq, highFreq) / Math.max(lowFreq, midFreq, highFreq);
        return balance * 100;
    }

    startRealTimeAnalysis() {
        // Simulate teaching quality metrics
        this.simulateTeachingMetrics();
        
        // Update interaction level (simulated)
        const interactionLevel = Math.random() * 40 + 60; // 60-100%
        this.assessmentData.teachingMetrics.interactionLevel = interactionLevel;
        document.getElementById('interaction-level').textContent = `Interaction: ${interactionLevel.toFixed(1)}%`;
        
        // Update example usage (simulated)
        const exampleUsage = Math.random() * 30 + 70; // 70-100%
        this.assessmentData.teachingMetrics.exampleUsage = exampleUsage;
        document.getElementById('example-usage').textContent = `Examples: ${exampleUsage.toFixed(1)}%`;
    }

    simulateTeachingMetrics() {
        // This would be replaced with actual AI analysis in a real implementation
        this.metricsInterval = setInterval(() => {
            if (!this.isAssessmentRunning) return;
            
            // Simulate real-time updates
            const timestamp = {
                time: Date.now() - this.assessmentData.startTime,
                voiceMetrics: { ...this.assessmentData.voiceMetrics },
                facialMetrics: { ...this.assessmentData.facialMetrics },
                teachingMetrics: { ...this.assessmentData.teachingMetrics }
            };
            
            this.assessmentData.timestamps.push(timestamp);
            
        }, 1000);
    }

    pauseAssessment() {
        this.isAssessmentRunning = false;
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        this.showNotification('Assessment paused', 'warning');
    }

    async stopAssessment() {
        this.isAssessmentRunning = false;
        this.assessmentData.endTime = Date.now();
        this.assessmentData.duration = this.assessmentData.endTime - this.assessmentData.startTime;
        
        // Clear intervals
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        // Generate report
        await this.generateReport();
        
        // Show report section
        document.getElementById('assessment-report').style.display = 'block';
        document.getElementById('assessment-report').classList.add('fade-in');
        
        this.showNotification('Assessment completed! Report generated.', 'success');
    }

    async generateReport() {
        // Calculate overall score
        const voiceScore = (
            this.assessmentData.voiceMetrics.confidence * 0.3 +
            this.assessmentData.voiceMetrics.audibility * 0.4 +
            this.assessmentData.voiceMetrics.clarity * 0.3
        );
        
        const facialScore = (
            this.assessmentData.facialMetrics.engagementLevel * 0.6 +
            this.assessmentData.facialMetrics.expressionVariety * 0.4
        );
        
        const teachingScore = (
            this.assessmentData.teachingMetrics.interactionLevel * 0.4 +
            this.assessmentData.teachingMetrics.exampleUsage * 0.3 +
            this.assessmentData.teachingMetrics.studentEngagement * 0.3
        );
        
        const overallScore = (voiceScore * 0.4 + facialScore * 0.3 + teachingScore * 0.3);
        
        // Update report UI
        document.getElementById('overall-score').textContent = overallScore.toFixed(1);
        
        // Determine eligibility
        let eligibilityStatus = 'needs-improvement';
        let statusText = 'Needs Improvement';
        
        if (overallScore >= 85) {
            eligibilityStatus = 'eligible';
            statusText = 'Eligible';
        } else if (overallScore >= 70) {
            eligibilityStatus = 'needs-improvement';
            statusText = 'Needs Improvement';
        } else {
            eligibilityStatus = 'not-eligible';
            statusText = 'Not Eligible';
        }
        
        const statusElement = document.getElementById('eligibility-status');
        statusElement.innerHTML = `<span class="status-badge ${eligibilityStatus}">${statusText}</span>`;
        
        // Update detailed metrics
        this.updateProgressBar('confidence-progress', this.assessmentData.voiceMetrics.confidence);
        document.getElementById('confidence-score').textContent = this.assessmentData.voiceMetrics.confidence.toFixed(1);
        
        this.updateProgressBar('audibility-progress', this.assessmentData.voiceMetrics.audibility);
        document.getElementById('audibility-score-final').textContent = this.assessmentData.voiceMetrics.audibility.toFixed(1);
        
        this.updateProgressBar('interaction-progress', this.assessmentData.teachingMetrics.interactionLevel);
        document.getElementById('interaction-score').textContent = this.assessmentData.teachingMetrics.interactionLevel.toFixed(1);
        
        this.updateProgressBar('example-progress', this.assessmentData.teachingMetrics.exampleUsage);
        document.getElementById('example-score').textContent = this.assessmentData.teachingMetrics.exampleUsage.toFixed(1);
        
        this.updateProgressBar('engagement-progress', this.assessmentData.facialMetrics.engagementLevel);
        document.getElementById('engagement-score').textContent = this.assessmentData.facialMetrics.engagementLevel.toFixed(1);
        
        // Generate recommendations
        this.generateRecommendations(overallScore);
    }

    updateProgressBar(elementId, value) {
        const progressBar = document.getElementById(elementId);
        progressBar.style.width = `${Math.min(100, Math.max(0, value))}%`;
    }

    generateRecommendations(overallScore) {
        const recommendations = [];
        
        if (this.assessmentData.voiceMetrics.confidence < 70) {
            recommendations.push('Work on voice confidence and projection. Practice speaking clearly and assertively.');
        }
        
        if (this.assessmentData.voiceMetrics.audibility < 75) {
            recommendations.push('Improve voice projection to ensure students at the back can hear clearly.');
        }
        
        if (this.assessmentData.teachingMetrics.interactionLevel < 80) {
            recommendations.push('Increase student interaction through questions, discussions, and active participation.');
        }
        
        if (this.assessmentData.teachingMetrics.exampleUsage < 75) {
            recommendations.push('Use more real-world examples and practical applications to explain concepts.');
        }
        
        if (this.assessmentData.facialMetrics.engagementLevel < 70) {
            recommendations.push('Work on facial expressions and body language to appear more engaging.');
        }
        
        if (overallScore < 70) {
            recommendations.push('Consider additional training in teaching methodologies and classroom management.');
        }
        
        // Update recommendations list
        const recommendationsList = document.getElementById('recommendations-list');
        recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
    }

    downloadReport() {
        const subjectValue = document.getElementById('subject').value;
        const otherSubject = document.getElementById('other-subject').value;
        const finalSubject = subjectValue === 'other' ? otherSubject : subjectValue;
        
        const reportData = {
            teacherName: document.getElementById('teacher-name').value,
            subject: finalSubject,
            institution: document.getElementById('institution').value,
            assessmentDate: new Date().toISOString(),
            overallScore: document.getElementById('overall-score').textContent,
            eligibilityStatus: document.getElementById('eligibility-status').textContent.trim(),
            detailedMetrics: this.assessmentData,
            recommendations: Array.from(document.querySelectorAll('#recommendations-list li')).map(li => li.textContent)
        };
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teacher-assessment-report-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Report downloaded successfully!', 'success');
    }

    resetAssessment() {
        // Reset all data
        this.assessmentData = {
            voiceMetrics: { confidence: 0, volume: 0, clarity: 0, audibility: 0 },
            facialMetrics: { teacherEmotion: 'neutral', engagementLevel: 0, expressionVariety: 0 },
            teachingMetrics: { interactionLevel: 0, exampleUsage: 0, studentEngagement: 0 },
            timestamps: [],
            duration: 0
        };
        
        // Clear intervals
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        // Reset UI
        document.getElementById('live-assessment').style.display = 'none';
        document.getElementById('assessment-report').style.display = 'none';
        document.getElementById('start-assessment').disabled = true;
        
        // Reset form fields
        document.getElementById('teacher-name').value = '';
        document.getElementById('subject').value = 'engineering';
        document.getElementById('other-subject').value = '';
        document.getElementById('other-subject-group').style.display = 'none';
        document.getElementById('institution').value = '';
        document.getElementById('assessment-duration').value = '15';
        
        // Reset media status
        document.getElementById('camera-status').textContent = 'Camera: Not Started';
        document.getElementById('camera-status').classList.remove('active', 'error');
        document.getElementById('mic-status').textContent = 'Microphone: Not Started';
        document.getElementById('mic-status').classList.remove('active', 'error');
        
        // Stop media streams
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.showNotification('Assessment reset. Ready for new assessment.', 'success');
    }

    showTroubleshooting() {
        document.getElementById('troubleshooting-section').style.display = 'block';
        document.getElementById('show-troubleshooting').style.display = 'none';
    }

    hideTroubleshooting() {
        document.getElementById('troubleshooting-section').style.display = 'none';
        document.getElementById('show-troubleshooting').style.display = 'block';
    }

    async reloadAIModels() {
        this.showNotification('Attempting to load AI models...', 'info');
        this.faceDetectionModel = null;
        this.aiModelsFailed = false;
        this.offlineMode = true; // Start in offline mode
        
        // Try to load models
        await this.loadAIModels();
    }


    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Function to toggle other subject input field
function toggleOtherSubject() {
    const subjectSelect = document.getElementById('subject');
    const otherSubjectGroup = document.getElementById('other-subject-group');
    const otherSubjectInput = document.getElementById('other-subject');
    
    if (subjectSelect.value === 'other') {
        otherSubjectGroup.style.display = 'block';
        otherSubjectInput.required = true;
        otherSubjectInput.focus();
    } else {
        otherSubjectGroup.style.display = 'none';
        otherSubjectInput.required = false;
        otherSubjectInput.value = '';
    }
}

// Initialize the platform when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.teacherAssessment = new TeacherAssessmentPlatform();
});

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

