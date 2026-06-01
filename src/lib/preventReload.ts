export const preventReload = () => {
  // Prevent F5, Ctrl+R, Cmd+R
  window.addEventListener('keydown', (e) => {
    if (
      e.key === 'F5' ||
      (e.ctrlKey && e.key === 'r') ||
      (e.metaKey && e.key === 'r')
    ) {
      e.preventDefault();
    }
  });

  // Prevent pull-to-refresh on mobile Safari
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const touchDiff = touchY - touchStartY;
    const isScrollingUp = touchDiff > 0;
    
    // If we are at the top of the page and trying to scroll up (pull-to-refresh)
    if (isScrollingUp && window.scrollY === 0) {
      // Check if we are inside a scrollable container that is not at the top
      let isScrollableContainerNotAtTop = false;
      let target = e.target as HTMLElement | null;
      
      while (target && target !== document.body) {
        if (target.scrollHeight > target.clientHeight && target.scrollTop > 0) {
          isScrollableContainerNotAtTop = true;
          break;
        }
        target = target.parentElement;
      }
      
      if (!isScrollableContainerNotAtTop) {
        e.preventDefault();
      }
    }
  }, { passive: false });
};
