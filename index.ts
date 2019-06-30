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
  constructor({ traversalDepth, linkExtractors, items = [] }: IScraperOptions) {
    this.traversalDepth = traversalDepth || this.traversalDepth;
    this.linkExtractors = linkExtractors || [];
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
    const linkElements = $(extractor.selector)
      .map((_, el) => {
        if (el.attribs["href"]) {
          let refUrl = $(el).attr("href");
          if (!this.isValidUrl(refUrl)) {
            refUrl = url.resolve(baseUrl.origin, refUrl);
          }
          return refUrl;
        }
      })
      .get();
    return linkElements.map(index => linkElements[index]);
    // for (const index in links) {
    //   const link = new Link(links[index]);
    //   extractor.callback(link);
    //   yield link;
    // }
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
    const extractedLinks = this.extractLinksFromPage(
      extractor,
      $,
      new URL(startUrl)
    );
    for (let l of extractedLinks) {
      yield l
    }
  }

  private async getPageContent(startUrl: string) {
    const { data: response } = await this.client.get(startUrl);
    const $ = cheerio.load(response);
    this.handleLinkExtraction($, startUrl);
  }

  public async scrape(startUrl: string) {}
}

class City extends Item {
  baseSelector = "ul li";
  name = new Field("a");
}

const extractor = new LinkExtractor({
  callback: link => {
    // console.log("found link", link.url);
  },
  selector: "div>ul li a",
  shouldFollow: false
});

const cityScraper = new Scraper({
  traversalDepth: 1,
  linkExtractors: [extractor]
});

cityScraper.scrape("https://health.usnews.com/doctors/city-index/utah");
