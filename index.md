---
layout: base.njk
title: My Blog Home
---

# Welcome to My Blog



Here are my recent posts:

{% for post in collections.posts %}
- [{{ post.data.title }}]({{ post.url | url }}) - {{ post.date | date: "%b %d, %Y" }}
{% endfor %}