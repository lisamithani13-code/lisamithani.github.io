document.addEventListener('DOMContentLoaded', function() {
    
    // ===== NAVIGATION SETUP =====
    const nav = document.querySelector('.case-nav');
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-menu a');
    const sections = document.querySelectorAll('section[id]');
    let isMenuOpen = false;

    // 1. Mobile Menu Toggle
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            document.body.style.overflow = isMenuOpen ? 'hidden' : '';
        });
    }

    // 2. Smooth Scrolling & Close Mobile Menu on Link Click
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Calculate correct scroll position (80px for nav height)
                const offsetTop = targetSection.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }

            // Close mobile menu if it's open
            if (isMenuOpen) {
                isMenuOpen = false;
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // 3. Update Active Nav Link on Scroll
    function updateActiveNavItem() {
        let currentSectionId = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 90; // Offset to trigger highlight sooner
            if (window.scrollY >= sectionTop) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    }

    // 4. Style Nav Bar on Scroll
    function handleNavScroll() {
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(255, 255, 255, 0.98)';
            nav.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
        } else {
            nav.style.background = 'rgba(255, 255, 255, 0.85)';
            nav.style.boxShadow = 'none';
        }
    }

    // Attach scroll listeners
    window.addEventListener('scroll', () => {
        updateActiveNavItem();
        handleNavScroll();
    });

    // Initial check in case page loads on a hash
    updateActiveNavItem();

});