import * as cheerio from "cheerio";
import { AxiosInstance } from "axios";
import Axios from "axios";
import * as url from "url";
import console = require("console");

abstract class Item {
  public readonly __name = "__item";
}

interface IScraperOptions {
  traversalDepth?: number;
  linkExtractors?: LinkExtractor[];
  items?: Item[];
  waitTimeinMSBetweenRequests?: number;
}

class ItemParser {
  public selector: string;
  public callback: (response: CheerioStatic) => void;
  constructor({ callback, selector }) {
    this.selector = selector;
    this.callback = callback;
  }
}

class Link {
  public readonly __name = "__link";
  constructor(public url: string) {}
}

class LinkExtractor {
  public selector: string;
  public callback: (link: Link) => any;
  public shouldFollow: boolean;
  constructor({ selector, callback, shouldFollow = false }) {
    this.selector = selector;
    this.callback = callback;
    this.shouldFollow = shouldFollow;
  }
}

class Field {
  public readonly __name = "__field";
  public static __name = "__field";
  public selector: string;
  constructor(selector: string) {
    this.selector = selector;
  }
}

class Scraper {
  private urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
  public readonly __name = "__scraper";
  private traversalDepth: number = 0;
  private client: AxiosInstance;
  public linkExtractors?: LinkExtractor[];
  public items?: Item[];
  private waitTime;
  private waitPromise: Promise<void>;
  constructor({
    traversalDepth,
    linkExtractors,
    items = [],
    waitTimeinMSBetweenRequests
  }: IScraperOptions) {
    this.traversalDepth = traversalDepth || this.traversalDepth;
    this.linkExtractors = linkExtractors || [];
    this.waitTime = waitTimeinMSBetweenRequests;
    this.initializeRequestAgent();
    this.items = items || [];
  }

  private initializeRequestAgent() {
    this.client = Axios.create();
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response.status === 401) {
          console.warn(JSON.stringify(error, null, 2));
        }
      }
    );
  }

  private extractLinksFromPage(
    extractor: LinkExtractor,
    $: CheerioStatic,
    baseUrl: URL
  ): Link[] {
    return $(extractor.selector)
      .map((_, el) => {
        if (el.attribs["href"]) {
          let refUrl = $(el).attr("href");
          if (!this.isValidUrl(refUrl)) {
            refUrl = url.resolve(baseUrl.origin, refUrl);
          }
          return refUrl;
        }
      })
      .get()
      .map(foundUrl => new Link(foundUrl));
  }

  private isValidUrl(url: string) {
    return this.urlRegex.test(url);
  }

  private getAllLinks($: CheerioStatic) {
    $("")
      .text.toString()
      .match(this.urlRegex);
  }

  private *handleLinkExtraction($: CheerioStatic, startUrl) {
    if (!this.linkExtractors) {
      return;
    }
    for (let extractor of this.linkExtractors) {
      for (let l of this.extractLinksFromPage(
        extractor,
        $,
        new URL(startUrl)
      )) {
        extractor.callback(l);
        yield l;
      }
    }
  }

  private async getPageContent(startUrl: string) {
    try {
      await this.waitPromise;
      const { data: response } = await this.client.get(startUrl);
      const $ = cheerio.load(response);
      for (let link of this.handleLinkExtraction($, startUrl)) {
        if (link && link.__name === "__link") {
          this.getPageContent(link.url);
        }
      }
      this.waitPromise = new Promise(resolve =>
        setTimeout(resolve, this.waitTime)
      );
    } catch (e) {
      throw new Error("failed to fetch webpage");
    }
  }

  public async scrape(startUrl: string) {
    this.getPageContent(startUrl);
  }
}

class City extends Item {
  baseSelector = "ul li";
  name = new Field("a");
}

const extractor = new LinkExtractor({
  callback: link => {
    console.log("found link", link);
  },
  selector: "div>ul li a",
  shouldFollow: false
});

const cityScraper = new Scraper({
  traversalDepth: 1,
  waitTimeinMSBetweenRequests: 100,
  linkExtractors: [extractor]
});

cityScraper.scrape("https://health.usnews.com/doctors/city-index/utah");
