const annotations = document.querySelectorAll('annotation');

for (const annotation of annotations) {
    annotation.addEventListener('click', event => {
        const comments = document.querySelector(`div#comments-${event.target.id}`);
        comments.style.left = event.pageX + 'px';
        comments.style.top = event.pageY + 'px';
        comments.classList.toggle('visible');
    });
}
