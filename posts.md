---
layout: base.njk
title: Posts
permalink: /posts/
---

# All Posts

{% for post in collections.posts %}
- [{{ post.data.title }}]({{ post.url }}) - {{ post.date | date: "%b %d, %Y" }}
{% endfor %}