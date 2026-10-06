import MarkdownIt from 'markdown-it';

// `html: false` escapes any raw HTML typed into the editor, so blog posts can never inject scripts.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true });

const renderToken: NonNullable<typeof md.renderer.rules.link_open> = (tokens, idx, options, _env, self) =>
  self.renderToken(tokens, idx, options);

const linkOpen = md.renderer.rules.link_open || renderToken;
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet('href') || '');
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return linkOpen(tokens, idx, options, env, self);
};

const image = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('loading', 'lazy');
  tokens[idx].attrSet('decoding', 'async');
  return image(tokens, idx, options, env, self);
};

const tableOpen = md.renderer.rules.table_open || renderToken;
md.renderer.rules.table_open = (tokens, idx, options, env, self) =>
  '<div class="table-wrap">' + tableOpen(tokens, idx, options, env, self);
const tableClose = md.renderer.rules.table_close || renderToken;
md.renderer.rules.table_close = (tokens, idx, options, env, self) => tableClose(tokens, idx, options, env, self) + '</div>';

export function renderMarkdown(src: string | null | undefined): string {
  return md.render(src || '');
}
