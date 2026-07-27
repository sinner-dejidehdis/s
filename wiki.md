---
layout: base.njk
title: Wiki Index
permalink: /wiki/
---

# Wiki Index

All entries, listed alphabetically.

<ul>
{% assign entries = collections.wikis | sort: "data.title" %}
{% for entry in entries %}
  <li><a href="{{ entry.url }}">{{ entry.data.title }}</a></li>
{% endfor %}
</ul>

{% if collections.wikis.size == 0 %}
<p><em>No wiki entries yet.</em></p>
{% endif %}
