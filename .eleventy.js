module.exports = function (eleventyConfig) {
  eleventyConfig.ignores.add(".claude/**");
  eleventyConfig.ignores.add("research/**");

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes"
    },
    pathPrefix: process.env.PATH_PREFIX || "/"
  };
};
