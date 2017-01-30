import { OpenchecksFrontPage } from './app.po';

describe('openchecks-front App', function() {
  let page: OpenchecksFrontPage;

  beforeEach(() => {
    page = new OpenchecksFrontPage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
