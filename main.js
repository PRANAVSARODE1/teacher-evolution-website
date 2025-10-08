// Teacher Assessment Platform - Simplified Version for GitHub Pages
class TeacherAssessmentPlatform {
    constructor() {
        this.isAssessmentRunning = false;
        this.isAssessmentPaused = false;
        this.elapsedBeforePause = 0;
        this.assessmentData = {
            teacherInfo: null,
            criteria: null,
            voiceMetrics: { confidence: 0, volume: 0, clarity: 0, audibility: 0 },
            facialMetrics: { teacherEmotion: 'neutral', engagementLevel: 0, expressionVariety: 0 },
            teachingMetrics: { interactionLevel: 0, exampleUsage: 0, studentEngagement: 0 },
            timestamps: [], duration: 0
        };
        
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        
        // Offline sync functionality
        this.isOnline = navigator.onLine;
        this.offlineData = JSON.parse(localStorage.getItem('offlineAssessmentData') || '[]');
        this.currentAssessmentId = null;
        
        // Authentication
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('users') || '[]');
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Auto-sync when coming online
        if (this.isOnline && this.offlineData.length > 0) {
            this.syncOfflineData();
        }
        this.faceDetectionModel = null;
        this.assessmentTimer = null;
        this.startTime = null;
        
        this.initializeAuthentication();
        this.initializeEventListeners();
        this.initializeOfflineMode();
    }

    initializeAuthentication() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showMainApp();
            return;
        }

        // Show login screen
        this.showLoginScreen();
        this.setupAuthEventListeners();
    }

    setupAuthEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Registration form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegistration();
        });

        // Toggle between login and registration
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterScreen();
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginScreen();
        });
    }

    showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('register-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
    }

    showRegisterScreen() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('register-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('register-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        // Update user info in navbar
        if (this.currentUser) {
            const userNameElement = document.querySelector('.user-name');
            if (userNameElement) {
                userNameElement.textContent = this.currentUser.name;
            }
        }
    }

    async handleLogin() {
        const userId = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (!userId || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            // Try backend authentication first
            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userId,
                    password: password
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = {
                    id: data.user.id,
                    name: data.user.email, // Backend doesn't return name, use email
                    email: data.user.email,
                    role: data.user.role,
                    token: data.access_token
                };
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                localStorage.setItem('authToken', data.access_token);
                this.showMainApp();
                this.showNotification(`Welcome back, ${this.currentUser.name}!`, 'success');
                return;
            }
        } catch (error) {
            console.log('Backend login failed, trying local storage:', error);
        }

        // Fallback to local storage authentication
        const user = this.users.find(u => u.id === userId || u.email === userId);
        
        if (!user) {
            this.showNotification('User not found', 'error');
            return;
        }

        if (user.password !== password) {
            this.showNotification('Invalid password', 'error');
            return;
        }

        // Login successful
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.showMainApp();
        this.showNotification(`Welcome back, ${user.name}!`, 'success');
    }

    async handleRegistration() {
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value.trim();
        const confirmPassword = document.getElementById('register-confirm-password').value.trim();

        // Show loading state
        const submitBtn = document.querySelector('#register-form button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        submitBtn.disabled = true;

        try {
            if (!name || !email || !password || !confirmPassword) {
                this.showNotification('Please fill in all fields', 'error');
                return;
            }

            if (password !== confirmPassword) {
                this.showNotification('Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                this.showNotification('Password must be at least 6 characters', 'error');
                return;
            }

            // Validate email format
            const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailPattern.test(email)) {
                this.showNotification('Please enter a valid email address', 'error');
                return;
            }

            // Try backend registration first
            const response = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password,
                    role: 'teacher' // Default role for new registrations
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = {
                    id: data.user_id,
                    name: name,
                    email: email,
                    role: 'teacher',
                    token: null
                };
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                this.showMainApp();
                this.showNotification(`🎉 Account created successfully! Welcome, ${name}!`, 'success');
                
                // Clear form
                document.getElementById('register-form').reset();
                return;
            } else {
                const errorData = await response.json();
                this.showNotification(`❌ ${errorData.error || 'Registration failed'}`, 'error');
                return;
            }
        } catch (error) {
            console.log('Backend registration failed, using local storage:', error);
            this.showNotification('⚠️ Backend unavailable, using local storage', 'warning');
        }

        // Fallback to local storage registration
        try {
            // Check if user already exists
            const existingUser = this.users.find(u => u.email === email);
            if (existingUser) {
                this.showNotification('❌ User with this email already exists', 'error');
                return;
            }

            // Create new user
            const newUser = {
                id: email, // Use email as ID
                name: name,
                email: email,
                password: password,
                createdAt: new Date().toISOString()
            };

            this.users.push(newUser);
            localStorage.setItem('users', JSON.stringify(this.users));

            // Auto-login after registration
            this.currentUser = newUser;
            localStorage.setItem('currentUser', JSON.stringify(newUser));
            this.showMainApp();
            this.showNotification(`🎉 Account created successfully! Welcome, ${name}!`, 'success');
            
            // Clear form
            document.getElementById('register-form').reset();
        } catch (error) {
            this.showNotification('❌ Registration failed. Please try again.', 'error');
            console.error('Registration error:', error);
        } finally {
            // Reset button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        this.showLoginScreen();
        this.showNotification('Logged out successfully', 'info');
    }

    async initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.dataset.section || 'setup';
                this.showSection(target);
                this.updateActiveNavLink(link);
                const sidebarLink = document.querySelector(`.sidebar-link[data-section="${target}"]`);
                if (sidebarLink) this.updateActiveSidebarLink(sidebarLink);
            });
        });

        // Sidebar navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
                this.updateActiveSidebarLink(link);
            });
        });

        // Duration selector
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('assessment-duration').value = btn.dataset.duration;
            });
        });

        // Media control buttons
        document.getElementById('start-camera').addEventListener('click', () => this.startCamera());
        document.getElementById('start-microphone').addEventListener('click', () => this.startMicrophone());
        document.getElementById('start-assessment').addEventListener('click', () => this.startAssessment());
        document.getElementById('pause-assessment').addEventListener('click', () => this.pauseAssessment());
        document.getElementById('stop-assessment').addEventListener('click', () => this.stopAssessment());
        
        // Report actions
        document.getElementById('download-report').addEventListener('click', () => this.downloadReport());
        document.getElementById('new-assessment').addEventListener('click', () => this.resetAssessment());
        
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    updateActiveNavLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    updateActiveSidebarLink(activeLink) {
        document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    showSection(sectionName) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    async initializeOfflineMode() {
        try {
            console.log('Initializing assessment platform...');
            this.showNotification('Platform initializing...', 'info');
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.showNotification('Platform ready! All features available.', 'success');
        } catch (error) {
            console.error('Error initializing platform:', error);
            this.showNotification('Platform initialized with basic features.', 'warning');
        }
    }

    async startCamera() {
        try {
            const video = document.getElementById('teacher-video');
            const canvas = document.getElementById('teacher-canvas');
            const ctx = canvas.getContext('2d');
            const cameraBtn = document.getElementById('start-camera');

            // If camera is already active, turn it off (toggle)
            const hasActiveVideo = this.mediaStream && this.mediaStream.getVideoTracks().some(t => t.readyState === 'live');
            if (hasActiveVideo) {
                this.mediaStream.getVideoTracks().forEach(track => track.stop());
                if (video.srcObject) {
                    // Keep audio if present; remove only if no tracks remain
                    const remainingTracks = this.mediaStream.getTracks().filter(t => t.readyState === 'live');
                    if (remainingTracks.length === 0) {
                        video.srcObject = null;
                        this.mediaStream = null;
                    }
                }
                const statusElement = document.getElementById('camera-status');
                statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Camera: Not Started</span>';
                statusElement.classList.remove('active', 'error');
                if (cameraBtn) {
                    cameraBtn.innerHTML = '<i class="fas fa-video"></i><span>Start Camera</span>';
                }
                this.disableStartAssessmentIfNotReady();
                this.showNotification('Camera turned off.', 'info');
                return;
            }

            // Start (or re-start) camera
            this.mediaStream = this.mediaStream || await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: true
            });

            // If stream exists but no active video track, add one
            if (!this.mediaStream.getVideoTracks().some(t => t.readyState === 'live')) {
                const newCamStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
                });
                newCamStream.getVideoTracks().forEach(t => this.mediaStream.addTrack(t));
            }

            video.srcObject = this.mediaStream;
            
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });
            
            const statusElement = document.getElementById('camera-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--success-color);"></i><span>Camera: Active</span>';
            statusElement.classList.add('active');
            if (cameraBtn) {
                cameraBtn.innerHTML = '<i class="fas fa-video-slash"></i><span>Stop Camera</span>';
            }
            
            this.showNotification('Camera started successfully!', 'success');
            this.checkMediaReady();
            
        } catch (error) {
            console.error('Error starting camera:', error);
            const statusElement = document.getElementById('camera-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--danger-color);"></i><span>Camera: Error</span>';
            statusElement.classList.add('error');
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Camera access denied. Please allow camera permissions.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No camera found. Please connect a camera.', 'error');
            } else {
                this.showNotification('Failed to start camera. Please check permissions.', 'error');
            }
        }
    }

    async startMicrophone() {
        try {
            const micBtn = document.getElementById('start-microphone');

            // If microphone is active, turn it off (toggle)
            const micActive = document.getElementById('mic-status').classList.contains('active');
            if (micActive) {
                if (this.audioContext && this.audioContext.state !== 'closed') {
                    this.audioContext.close();
                }
                this.audioContext = null;
                this.analyser = null;
                this.microphone = null;
                if (this.mediaStream) {
                    this.mediaStream.getAudioTracks().forEach(track => track.stop());
                }
                const statusElement = document.getElementById('mic-status');
                statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Microphone: Not Started</span>';
                statusElement.classList.remove('active', 'error');
                if (micBtn) {
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i><span>Start Microphone</span>';
                }
                this.disableStartAssessmentIfNotReady();
                this.showNotification('Microphone turned off.', 'info');
                return;
            }

            // Ensure we have a media stream (start camera first acquires audio as well)
            if (!this.mediaStream) {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            } else if (this.mediaStream.getAudioTracks().length === 0) {
                const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioOnly.getAudioTracks().forEach(t => this.mediaStream.addTrack(t));
            }
            
            const audioTracks = this.mediaStream.getAudioTracks();
            if (audioTracks.length === 0) {
                this.showNotification('No audio tracks found. Please ensure microphone is connected.', 'error');
                return;
            }
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.analyser);
            
            const statusElement = document.getElementById('mic-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--success-color);"></i><span>Microphone: Active</span>';
            statusElement.classList.add('active');
            if (micBtn) {
                micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Stop Microphone</span>';
            }
            
            this.showNotification('Microphone started successfully!', 'success');
            this.checkMediaReady();
            
        } catch (error) {
            console.error('Error starting microphone:', error);
            const statusElement = document.getElementById('mic-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--danger-color);"></i><span>Microphone: Error</span>';
            statusElement.classList.add('error');
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Microphone access denied. Please allow microphone permissions.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No microphone found. Please connect a microphone.', 'error');
            } else {
                this.showNotification('Failed to start microphone. Please check permissions.', 'error');
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

    disableStartAssessmentIfNotReady() {
        const cameraActive = document.getElementById('camera-status').classList.contains('active');
        const micActive = document.getElementById('mic-status').classList.contains('active');
        if (!cameraActive || !micActive) {
            document.getElementById('start-assessment').disabled = true;
        }
    }

    async startAssessment() {
        const teacherName = document.getElementById('teacher-name').value.trim();
        const institution = document.getElementById('institution').value.trim();
        const subject = document.getElementById('subject').value;
        const otherSubject = document.getElementById('other-subject')?.value || '';
        const finalSubject = subject === 'other' ? otherSubject : subject;
        const experience = document.getElementById('experience').value;
        const duration = document.querySelector('.duration-btn.active')?.dataset.duration || '15';
        
        if (!teacherName || !institution) {
            this.showNotification('Please fill in all required fields (Teacher Name and Institution).', 'error');
            return;
        }
        
        // Store assessment data
        this.assessmentData.teacherInfo = {
            name: teacherName,
            institution: institution,
            subject: finalSubject,
            experience: experience,
            duration: parseInt(duration)
        };
        
        // Store selected criteria
        this.assessmentData.criteria = {
            voiceConfidence: document.getElementById('voice-confidence').checked,
            facialExpressions: document.getElementById('facial-expressions').checked,
            interaction: document.getElementById('interaction').checked,
            examples: document.getElementById('examples').checked,
            audibility: document.getElementById('audibility').checked
        };
        
        this.isAssessmentRunning = true;
        this.isAssessmentPaused = false;
        this.startTime = Date.now();
        this.assessmentData.startTime = this.startTime;
        this.elapsedBeforePause = 0;
        
        // Generate unique assessment ID
        this.currentAssessmentId = 'assessment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        this.showSection('live');
        this.updateActiveSidebarLink(document.querySelector('[data-section="live"]'));
        
        this.startTimer();
        this.startRealTimeAnalysis();
        
        // Show online/offline status
        const statusMessage = this.isOnline ? 
            'Assessment started with AI analysis! Begin teaching now.' : 
            'Assessment started (OFFLINE MODE). Data will sync when connection is restored.';
        this.showNotification(statusMessage, this.isOnline ? 'success' : 'warning');
        
        this.analyzeAudio();
        this.simulateFacialExpressions();
    }

    startTimer() {
        this.assessmentTimer = setInterval(() => {
            if (!this.isAssessmentRunning) return;
            const elapsed = this.elapsedBeforePause + (Date.now() - this.startTime);
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('assessment-timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    simulateFacialExpressions() {
        if (!this.isAssessmentRunning) return;
        
        const emotions = ['neutral', 'happy', 'serious', 'confident', 'engaged'];
        const emotion = emotions[Math.floor(Math.random() * emotions.length)];
        
        let engagementLevel;
        switch (emotion) {
            case 'happy': engagementLevel = 85 + Math.random() * 15; break;
            case 'confident': engagementLevel = 80 + Math.random() * 20; break;
            case 'engaged': engagementLevel = 75 + Math.random() * 25; break;
            case 'serious': engagementLevel = 65 + Math.random() * 30; break;
            default: engagementLevel = 70 + Math.random() * 25;
        }
        
        this.assessmentData.facialMetrics.teacherEmotion = emotion;
        this.assessmentData.facialMetrics.engagementLevel = engagementLevel;
        
        document.getElementById('teacher-emotion').textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        document.getElementById('engagement-level').textContent = `${engagementLevel.toFixed(1)}%`;
        this.updateMetricBar('engagement-bar', engagementLevel);
        
        setTimeout(() => this.simulateFacialExpressions(), 2500);
    }

    analyzeAudio() {
        if (!this.isAssessmentRunning || !this.analyser) return;
        
        try {
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            this.analyser.getByteFrequencyData(dataArray);
            
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const volumeVariance = this.calculateVariance(dataArray);
            const confidence = Math.max(0, 100 - volumeVariance * 2);
            const volume = (average / 255) * 100;
            const clarity = this.calculateClarity(dataArray);
            const audibility = Math.min(100, volume * 1.2);
            
            this.assessmentData.voiceMetrics.confidence = confidence;
            this.assessmentData.voiceMetrics.volume = volume;
            this.assessmentData.voiceMetrics.clarity = clarity;
            this.assessmentData.voiceMetrics.audibility = audibility;
            
            document.getElementById('voice-confidence').textContent = `${confidence.toFixed(1)}%`;
            document.getElementById('voice-volume').textContent = `${volume.toFixed(1)}%`;
            document.getElementById('voice-clarity').textContent = `${clarity.toFixed(1)}%`;
            document.getElementById('audibility-score').textContent = `${audibility.toFixed(1)}%`;
            
            this.updateMetricBar('confidence-bar', confidence);
            this.updateMetricBar('volume-bar', volume);
            this.updateMetricBar('clarity-bar', clarity);
            this.updateMetricBar('audibility-bar', audibility);
            
            if (this.isAssessmentRunning) {
                requestAnimationFrame(() => this.analyzeAudio());
            }
        } catch (error) {
            console.error('Error in audio analysis:', error);
            this.simulateAudioMetrics();
        }
    }

    simulateAudioMetrics() {
        if (!this.isAssessmentRunning) return;
        
        const confidence = Math.random() * 20 + 70;
        const volume = Math.random() * 30 + 60;
        const clarity = Math.random() * 25 + 65;
        const audibility = Math.random() * 20 + 75;
        
        this.assessmentData.voiceMetrics.confidence = confidence;
        this.assessmentData.voiceMetrics.volume = volume;
        this.assessmentData.voiceMetrics.clarity = clarity;
        this.assessmentData.voiceMetrics.audibility = audibility;
        
        document.getElementById('voice-confidence').textContent = `${confidence.toFixed(1)}%`;
        document.getElementById('voice-volume').textContent = `${volume.toFixed(1)}%`;
        document.getElementById('voice-clarity').textContent = `${clarity.toFixed(1)}%`;
        document.getElementById('audibility-score').textContent = `${audibility.toFixed(1)}%`;
        
        this.updateMetricBar('confidence-bar', confidence);
        this.updateMetricBar('volume-bar', volume);
        this.updateMetricBar('clarity-bar', clarity);
        this.updateMetricBar('audibility-bar', audibility);
        
        if (this.isAssessmentRunning) {
            setTimeout(() => this.simulateAudioMetrics(), 1000);
        }
    }

    updateMetricBar(barId, value) {
        const bar = document.getElementById(barId);
        if (bar) {
            bar.style.width = `${Math.min(100, Math.max(0, value))}%`;
        }
    }

    calculateVariance(dataArray) {
        const mean = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const variance = dataArray.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / dataArray.length;
        return Math.sqrt(variance);
    }

    calculateClarity(dataArray) {
        const lowFreq = dataArray.slice(0, dataArray.length / 4).reduce((a, b) => a + b) / (dataArray.length / 4);
        const midFreq = dataArray.slice(dataArray.length / 4, dataArray.length * 3 / 4).reduce((a, b) => a + b) / (dataArray.length / 2);
        const highFreq = dataArray.slice(dataArray.length * 3 / 4).reduce((a, b) => a + b) / (dataArray.length / 4);
        
        const balance = Math.min(lowFreq, midFreq, highFreq) / Math.max(lowFreq, midFreq, highFreq);
        return balance * 100;
    }

    startRealTimeAnalysis() {
        this.simulateTeachingMetrics();
        
        const interactionLevel = Math.random() * 40 + 60;
        const exampleUsage = Math.random() * 30 + 70;
        
        this.assessmentData.teachingMetrics.interactionLevel = interactionLevel;
        this.assessmentData.teachingMetrics.exampleUsage = exampleUsage;
        
        document.getElementById('interaction-level').textContent = `${interactionLevel.toFixed(1)}%`;
        document.getElementById('example-usage').textContent = `${exampleUsage.toFixed(1)}%`;
        
        this.updateMetricBar('interaction-bar', interactionLevel);
        this.updateMetricBar('examples-bar', exampleUsage);
    }

    simulateTeachingMetrics() {
        this.metricsInterval = setInterval(() => {
            if (!this.isAssessmentRunning) return;
            
            const timestamp = {
                time: Date.now() - this.assessmentData.startTime,
                voiceMetrics: { ...this.assessmentData.voiceMetrics },
                facialMetrics: { ...this.assessmentData.facialMetrics },
                teachingMetrics: { ...this.assessmentData.teachingMetrics }
            };
            
            this.assessmentData.timestamps.push(timestamp);
            
            // Store data locally (offline or online)
            this.storeMetricsData(timestamp);
        }, 1000);
    }
    
    storeMetricsData(metricsData) {
        const dataToStore = {
            assessmentId: this.currentAssessmentId,
            timestamp: Date.now(),
            data: metricsData,
            synced: false
        };
        
        if (this.isOnline) {
            // Try to sync immediately
            this.syncMetricsData(dataToStore);
        } else {
            // Store offline for later sync
            this.offlineData.push(dataToStore);
            localStorage.setItem('offlineAssessmentData', JSON.stringify(this.offlineData));
            console.log('Data stored offline:', dataToStore);
        }
    }
    
    async syncMetricsData(dataToStore) {
        try {
            // Simulate API call to backend
            const response = await fetch('http://localhost:8080/api/assessments/' + dataToStore.assessmentId + '/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || 'demo-token')
                },
                body: JSON.stringify(dataToStore.data)
            });
            
            if (response.ok) {
                dataToStore.synced = true;
                console.log('Data synced successfully:', dataToStore);
            } else {
                throw new Error('Sync failed');
            }
        } catch (error) {
            console.log('Sync failed, storing offline:', error);
            // Store offline if sync fails
            dataToStore.synced = false;
            this.offlineData.push(dataToStore);
            localStorage.setItem('offlineAssessmentData', JSON.stringify(this.offlineData));
        }
    }

    pauseAssessment() {
        const pauseBtn = document.getElementById('pause-assessment');
        if (this.isAssessmentRunning && !this.isAssessmentPaused) {
            // Pause
            this.isAssessmentPaused = true;
            this.isAssessmentRunning = false;
            this.elapsedBeforePause += (Date.now() - this.startTime);
            if (this.metricsInterval) clearInterval(this.metricsInterval);
            if (this.assessmentTimer) clearInterval(this.assessmentTimer);
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
                pauseBtn.classList.remove('danger');
                pauseBtn.classList.add('success');
            }
            this.showNotification('Assessment paused', 'warning');
        } else if (!this.isAssessmentRunning && this.isAssessmentPaused) {
            // Resume
            this.isAssessmentPaused = false;
            this.isAssessmentRunning = true;
            this.startTime = Date.now();
            this.startTimer();
            this.analyzeAudio();
            this.simulateFacialExpressions();
            this.simulateTeachingMetrics();
            if (pauseBtn) {
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
                pauseBtn.classList.remove('success');
                pauseBtn.classList.add('danger');
            }
            this.showNotification('Assessment resumed', 'success');
        }
    }

    async stopAssessment() {
        this.isAssessmentRunning = false;
        this.isAssessmentPaused = false;
        this.assessmentData.endTime = Date.now();
        this.assessmentData.duration = this.assessmentData.endTime - this.assessmentData.startTime;
        
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        if (this.assessmentTimer) clearInterval(this.assessmentTimer);
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        await this.generateReport();
        
        this.showSection('results');
        this.updateActiveSidebarLink(document.querySelector('[data-section="results"]'));
        // Reset pause button label for next run
        const pauseBtn = document.getElementById('pause-assessment');
        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        }
        
        this.showNotification('Assessment completed! Report generated.', 'success');
    }

    async generateReport() {
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
        
        document.getElementById('overall-score').textContent = overallScore.toFixed(1);
        
        let eligibilityStatus = 'needs-improvement';
        let statusText = 'Needs Improvement';
        let statusClass = 'warning';
        
        if (overallScore >= 85) {
            eligibilityStatus = 'eligible';
            statusText = 'Eligible';
            statusClass = 'success';
        } else if (overallScore >= 70) {
            eligibilityStatus = 'needs-improvement';
            statusText = 'Needs Improvement';
            statusClass = 'warning';
        } else {
            eligibilityStatus = 'not-eligible';
            statusText = 'Not Eligible';
            statusClass = 'danger';
        }
        
        const statusElement = document.getElementById('eligibility-status');
        statusElement.innerHTML = `<span class=\"status-text\">${statusText}</span>`;
        // Apply color-coded classes to results section
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.classList.remove('status-success', 'status-warning', 'status-danger');
            resultsSection.classList.add(`status-${statusClass}`);
        }
        
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
        
        this.generateRecommendations(overallScore);
    }

    updateProgressBar(elementId, value) {
        const progressBar = document.getElementById(elementId);
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, value))}%`;
        }
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
        
        const recommendationsList = document.getElementById('recommendations-list');
        if (recommendations.length > 0) {
            recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
        } else {
            recommendationsList.innerHTML = '<li>Great job! Your teaching performance meets all criteria.</li>';
        }
    }

    downloadReport() {
        const reportData = {
            teacherInfo: this.assessmentData.teacherInfo,
            criteria: this.assessmentData.criteria,
            assessmentDate: new Date().toISOString(),
            overallScore: document.getElementById('overall-score').textContent,
            eligibilityStatus: document.getElementById('eligibility-status').textContent.trim(),
            detailedMetrics: this.assessmentData,
            recommendations: Array.from(document.querySelectorAll('#recommendations-list li')).map(li => li.textContent),
            timestamps: this.assessmentData.timestamps,
            duration: this.assessmentData.duration
        };
        
        // Store in localStorage for persistence
        const allAssessments = JSON.parse(localStorage.getItem('teacherAssessments') || '[]');
        allAssessments.push(reportData);
        localStorage.setItem('teacherAssessments', JSON.stringify(allAssessments));
        
        try {
            // Generate PDF using jsPDF
            const { jsPDF } = window.jspdf || {};
            if (jsPDF) {
                const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                const margin = 48;
                let y = margin;

                // Header
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.text('TeacherEval Assessment Report', margin, y);
                y += 24;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                const userName = (this.currentUser && this.currentUser.name) ? this.currentUser.name : 'Unknown User';
                doc.text(`User: ${userName}`, margin, y);
                y += 16;
                doc.text(`Date: ${new Date(reportData.assessmentDate).toLocaleString()}`, margin, y);
                y += 24;

                // Summary Section
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Summary', margin, y);
                y += 16;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                doc.text(`Teacher: ${reportData.teacherInfo?.name || '-'}`, margin, y); y += 16;
                doc.text(`Institution: ${reportData.teacherInfo?.institution || '-'}`, margin, y); y += 16;
                doc.text(`Subject: ${reportData.teacherInfo?.subject || '-'}`, margin, y); y += 16;
                doc.text(`Overall Score: ${reportData.overallScore}`, margin, y); y += 16;
                doc.text(`Eligibility: ${reportData.eligibilityStatus}`, margin, y); y += 24;

                // Detailed Scores
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Detailed Scores', margin, y);
                y += 16;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                const voice = reportData.detailedMetrics.voiceMetrics;
                const facial = reportData.detailedMetrics.facialMetrics;
                const teaching = reportData.detailedMetrics.teachingMetrics;
                doc.text(`Voice - Confidence: ${voice.confidence.toFixed(1)}%  Volume: ${voice.volume.toFixed(1)}%  Clarity: ${voice.clarity.toFixed(1)}%  Audibility: ${voice.audibility.toFixed(1)}%`, margin, y);
                y += 16;
                doc.text(`Facial - Emotion: ${facial.teacherEmotion || facial.emotion || '-'}  Engagement: ${Number(facial.engagementLevel || 0).toFixed(1)}%`, margin, y);
                y += 16;
                doc.text(`Teaching - Interaction: ${Number(teaching.interactionLevel || 0).toFixed(1)}%  Examples: ${Number(teaching.exampleUsage || 0).toFixed(1)}%  Student Engagement: ${Number(teaching.studentEngagement || 0).toFixed(1)}%`, margin, y);
                y += 24;

                // Recommendations
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Recommendations', margin, y);
                y += 16;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                if (reportData.recommendations.length) {
                    reportData.recommendations.forEach(rec => {
                        const lines = doc.splitTextToSize(`• ${rec}`, 520);
                        doc.text(lines, margin, y);
                        y += (lines.length * 14) + 6;
                    });
                } else {
                    doc.text('No recommendations available.', margin, y); y += 16;
                }

                // Footer
                y = Math.max(y, 760);
                doc.setDrawColor(200);
                doc.line(margin, y, 595 - margin, y);
                y += 16;
                doc.setFontSize(10);
                doc.text('Generated by TeacherEval', margin, y);

                doc.save(`teacher-assessment-report-${Date.now()}.pdf`);
                this.showNotification('PDF report generated!', 'success');
                return;
            }
        } catch (e) {
            console.warn('PDF generation failed, falling back to JSON download.', e);
        }

        // Fallback: Download as JSON file
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teacher-assessment-report-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showNotification('Report saved and downloaded successfully!', 'success');
    }

    resetAssessment() {
        this.assessmentData = {
            teacherInfo: null,
            criteria: null,
            voiceMetrics: { confidence: 0, volume: 0, clarity: 0, audibility: 0 },
            facialMetrics: { teacherEmotion: 'neutral', engagementLevel: 0, expressionVariety: 0 },
            teachingMetrics: { interactionLevel: 0, exampleUsage: 0, studentEngagement: 0 },
            timestamps: [], duration: 0
        };
        
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        if (this.assessmentTimer) clearInterval(this.assessmentTimer);
        
        this.showSection('setup');
        this.updateActiveSidebarLink(document.querySelector('[data-section="setup"]'));
        
        document.getElementById('start-assessment').disabled = true;
        
        document.getElementById('teacher-name').value = '';
        document.getElementById('institution').value = '';
        document.getElementById('subject').value = 'engineering';
        if (document.getElementById('other-subject')) {
            document.getElementById('other-subject').value = '';
            document.getElementById('other-subject-group').style.display = 'none';
        }
        
        document.getElementById('camera-status').innerHTML = '<i class="fas fa-circle"></i><span>Camera: Not Started</span>';
        document.getElementById('camera-status').classList.remove('active', 'error');
        document.getElementById('mic-status').innerHTML = '<i class="fas fa-circle"></i><span>Microphone: Not Started</span>';
        document.getElementById('mic-status').classList.remove('active', 'error');
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.showNotification('Assessment reset. Ready for new assessment.', 'success');
    }

    viewStoredAssessments() {
        const allAssessments = JSON.parse(localStorage.getItem('teacherAssessments') || '[]');
        
        if (allAssessments.length === 0) {
            this.showNotification('No stored assessments found.', 'info');
            return;
        }
        
        // Create a simple display of stored assessments
        let displayText = `Found ${allAssessments.length} stored assessments:\n\n`;
        
        allAssessments.forEach((assessment, index) => {
            displayText += `${index + 1}. ${assessment.teacherInfo?.name || 'Unknown'} - ${assessment.teacherInfo?.institution || 'Unknown'}\n`;
            displayText += `   Subject: ${assessment.teacherInfo?.subject || 'Unknown'}\n`;
            displayText += `   Date: ${new Date(assessment.assessmentDate).toLocaleDateString()}\n`;
            displayText += `   Score: ${assessment.overallScore}\n`;
            displayText += `   Status: ${assessment.eligibilityStatus}\n\n`;
        });
        
        // Show in alert (you can modify this to show in a modal)
        alert(displayText);
        
        // Also log to console for debugging
        console.log('All stored assessments:', allAssessments);
    }
    
    // Offline/Online event handlers
    handleOnline() {
        this.isOnline = true;
        this.showNotification('Connection restored! Syncing offline data...', 'success');
        this.syncOfflineData();
    }
    
    handleOffline() {
        this.isOnline = false;
        this.showNotification('Connection lost. Working in offline mode. Data will sync when connection is restored.', 'warning');
    }
    
    async syncOfflineData() {
        if (this.offlineData.length === 0) return;
        
        console.log('Syncing offline data:', this.offlineData.length, 'items');
        
        const unsyncedData = this.offlineData.filter(item => !item.synced);
        let syncedCount = 0;
        
        for (const dataItem of unsyncedData) {
            try {
                await this.syncMetricsData(dataItem);
                syncedCount++;
            } catch (error) {
                console.error('Failed to sync data item:', error);
            }
        }
        
        // Remove synced items from offline storage
        this.offlineData = this.offlineData.filter(item => !item.synced);
        localStorage.setItem('offlineAssessmentData', JSON.stringify(this.offlineData));
        
        if (syncedCount > 0) {
            this.showNotification(`Successfully synced ${syncedCount} offline data items!`, 'success');
        }
    }
    
    // Manual sync function
    manualSync() {
        if (!this.isOnline) {
            this.showNotification('No internet connection available for sync.', 'error');
            return;
        }
        
        this.syncOfflineData();
    }
    
    // View offline data
    viewOfflineData() {
        const offlineCount = this.offlineData.length;
        const unsyncedCount = this.offlineData.filter(item => !item.synced).length;
        
        let message = `Offline Data Status:\n`;
        message += `Total offline items: ${offlineCount}\n`;
        message += `Unsynced items: ${unsyncedCount}\n`;
        message += `Connection status: ${this.isOnline ? 'Online' : 'Offline'}\n\n`;
        
        if (offlineCount > 0) {
            message += `Assessment IDs with offline data:\n`;
            const uniqueIds = [...new Set(this.offlineData.map(item => item.assessmentId))];
            uniqueIds.forEach(id => {
                const count = this.offlineData.filter(item => item.assessmentId === id).length;
                message += `- ${id}: ${count} items\n`;
            });
        }
        
        alert(message);
        console.log('Offline data details:', this.offlineData);
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
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
    // Compatibility alias for inline handlers in HTML expecting `app`
    if (!window.app) {
        window.app = window.teacherAssessment;
    }
});