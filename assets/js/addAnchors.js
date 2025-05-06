window.onload = function () {
	const headings = document.querySelectorAll("h2, h3, h4, h5, h6");
	for (const heading of headings) {
		heading.innerHTML =
			'<a href="#' + heading.id + '">' + heading.innerHTML + "</a>";
	}
};
