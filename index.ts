import * as cheerio from "cheerio";
import axios from "axios";
import * as url from "url";

abstract class Item {
  public __name = "__itemtype";
}

class Plane extends Item {
  public title: string = "";
  public price: number = 0;
}

class CraigslistScraper {
  constructor(private query = "") {}
  async getNextLink(data) {}
  async parsePage(pageUrl: string) {
    try {
      const { data, status } = await axios.get(
        url.resolve(
          pageUrl,
          `/search/sss?query=${encodeURIComponent(this.query)}&sort=rel`
        )
      );
      const $ = cheerio.load(data);
      return {
        *[Symbol.iterator]() {
          const d = $("ul > li .result-info")
            .map((_, el) => {
              const plane = new Plane();
              const price = $(".result-price", el).text();
              plane.title = $(".result-title", el).text();
              plane.price = parseInt(price.replace("$", ""), 10);
              return plane;
            })
            .get();
          for (let idx in d) {
            yield d[idx];
          }
        }
      };
    } catch (e) {
      console.log('error parsing page')
    }
  }
  async getLocations() {
    try {
      const { data, status } = await axios.get(
        "https://geo.craigslist.org/iso/us"
      );
      if (status === 200 && data) {
        const $ = cheerio.load(data);

        const d = $("ul > li > a");
        return {
          *[Symbol.iterator]() {
            for (const el in d) {
              if (!d[el].attribs || !d[el].attribs.href) {
                continue;
              }
              const url = d[el].attribs.href;
              yield url;
            }
          }
        };
      } else {
        console.log("error");
      }
    } catch (e) {
      console.log("Error getting locations");
    }
  }
  async scrape(resultCallback=(result: Item) => {}) {
    for (let value of await this.getLocations()) {
      for (let result of await this.parsePage(value)) {
        resultCallback(result)
      }
    }
    return Promise.resolve()
  }
}

const results =[]

const scraper = new CraigslistScraper("cessna");

const logResult = (result: Item) => {
  results.push(result)
}

scraper.scrape(logResult).then(() => {
  console.log('res', results)
})
