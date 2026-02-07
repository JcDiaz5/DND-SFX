# Images

Put your images here (e.g. backgrounds, icons).

**Background photos:** You can add a subfolder `backgrounds/` and place image files there (e.g. `.jpg`, `.png`, `.webp`).

**Using them in CSS:** Reference with the Flask static URL:

```css
body {
    background-image: url("/static/images/backgrounds/your-image.jpg");
    background-size: cover;
    background-position: center;
}
```

**Using them in templates:** Use `url_for('static', filename='images/backgrounds/your-image.jpg')`.
