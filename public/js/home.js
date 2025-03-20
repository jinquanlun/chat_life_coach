// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    // 平滑滚动功能
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // 考虑导航栏高度
                    behavior: 'smooth'
                });
            }
        });
    });

    // 导航栏滚动效果
    const header = document.querySelector('.header');
    let lastScrollTop = 0;

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 添加滚动样式
        if (scrollTop > 50) {
            header.classList.add('header-scrolled');
        } else {
            header.classList.remove('header-scrolled');
        }
        
        lastScrollTop = scrollTop;
    });

    // 特色卡片悬停效果
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.classList.add('feature-card-hover');
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('feature-card-hover');
        });
    });

    // 图片加载失败处理
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', function() {
            // 设置默认图片
            if (this.classList.contains('hero-img')) {
                this.src = 'https://via.placeholder.com/600x400?text=AI+Life+Coach';
            } else if (this.classList.contains('use-case-img')) {
                this.src = 'https://via.placeholder.com/300x200?text=Use+Case';
            } else if (this.classList.contains('author-img')) {
                this.src = 'https://via.placeholder.com/100x100?text=User';
            } else if (this.classList.contains('about-img')) {
                this.src = 'https://via.placeholder.com/400x300?text=About+Us';
            }
        });
    });
}); 