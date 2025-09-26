document.addEventListener('DOMContentLoaded', function() {
    
    // ===== NAVIGATION =====
    const nav = document.querySelector('.nav');
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    let isMenuOpen = false;

    // Toggle mobile menu
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            document.body.style.overflow = isMenuOpen ? 'hidden' : '';
        });
    }

    // Close mobile menu when a link is clicked
    const allNavLinks = document.querySelectorAll('.nav-menu a');
    allNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isMenuOpen) {
                isMenuOpen = false;
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // Handle sticky navigation style on scroll
    function handleNavScroll() {
        if (!nav) return;
        if (window.scrollY > 50) {
            nav.style.background = 'rgba(255, 255, 255, 0.98)';
            nav.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
        } else {
            nav.style.background = 'rgba(255, 255, 255, 0.95)';
            nav.style.boxShadow = 'none';
        }
    }
    
    window.addEventListener('scroll', handleNavScroll);


    // ===== PROJECT PREVIEW INTERACTIONS (GIF on Hover) =====
    const projectCards = document.querySelectorAll('.project-card-ai');
    
    projectCards.forEach(card => {
        const hoverGif = card.querySelector('.ui-hover-gif');
        const uiPreview = card.querySelector('.project-ui-preview');

        // Preload GIFs for smoother hover effect
        if (hoverGif && hoverGif.src) {
            const img = new Image();
            img.src = hoverGif.src;
        }

        // Add 3D tilt effect on mouse move
        if (uiPreview) {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                
                const rotateX = (y - 0.5) * -10; // Invert for natural feel
                const rotateY = (x - 0.5) * 10;
                
                uiPreview.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
            });
            
            card.addEventListener('mouseleave', () => {
                uiPreview.style.transform = '';
            });
        }
    });

});