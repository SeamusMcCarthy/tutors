import path from "path-browserify";
import type { Course } from "src/models/course";
import type { Lo } from "../types/lo-types";
import { writeObj } from "./firebase-utils";

export function injectCourseUrl(lo: Lo, url) {
  if (lo.route) lo.route = lo.route.replace("{{COURSEURL}}", url);
  if (lo.img) lo.img = lo.img.replace("{{COURSEURL}}", url);
  if (lo.video) lo.video = lo.video.replace("{{COURSEURL}}", url);
  if (lo.pdf) lo.pdf = lo.pdf.replace("{{COURSEURL}}", url);
  if (lo.los) {
    lo.los.forEach((lo) => {
      injectCourseUrl(lo, url);
    });
  }
}

export function flattenLos(los: Lo[]): Lo[] {
  let result: Lo[] = [];
  los.forEach((lo) => {
    result.push(lo);
    if (lo.los) result = result.concat(flattenLos(lo.los));
  });
  return result;
}

function removeLastDirectory(the_url) {
  const the_arr = the_url.split("/");
  the_arr.pop();
  return the_arr.join("/");
}

export function removeLeadingHashes(str: string): string {
  if (str.includes("#")) {
    str = str.substr(str.lastIndexOf("#") + 1);
  }
  return str;
}

export function findCourseUrls(labUrl: string): string[] {
  let topicUrl = removeLastDirectory(labUrl);
  if (path.basename(topicUrl).startsWith("unit") && topicUrl.includes("topic")) {
    topicUrl = removeLastDirectory(topicUrl);
  }
  const courseUrl = removeLastDirectory(topicUrl);
  return [courseUrl, topicUrl];
}

export function lastSegment(url: string) {
  const parts = url.split("/");
  const lastSegment = parts.pop() || parts.pop();
  return lastSegment;
}

export function threadLos(parent: Lo) {
  parent.los.forEach((lo) => {
    lo.parentLo = parent;
    if (lo.los) {
      threadLos(lo);
    }
  });
}

export function findLos(los: Lo[], lotype: string): Lo[] {
  let result: Lo[] = [];
  los.forEach((lo) => {
    if (lo.type === lotype) {
      result.push(lo);
    }
    if (lo.type == "unit") {
      result = result.concat(findLos(lo.los, lotype));
    }
  });
  return result;
}

export function findVideoLos(los: Lo[]): Lo[] {
  let result: Lo[] = [];
  los.forEach((lo) => {
    if (lo.video) {
      result.push(lo);
    }
    if (lo.type == "unit") {
      result = result.concat(findVideoLos(lo.los));
    }
  });
  return result;
}

export function allLos(lotype: string, los: Lo[]) {
  let allLos: Lo[] = [];
  for (const topic of los) {
    allLos = allLos.concat(findLos(topic.los, lotype));
  }
  return allLos;
}

export function allVideoLos(los: Lo[]) {
  let allLos: Lo[] = [];
  for (const topic of los) {
    allLos = allLos.concat(findVideoLos(topic.los));
  }
  return allLos;
}

export function fixRoutes(lo: Lo) {
  if (lo.route && lo.route[0] == "#") {
    lo.route = lo.route.slice(1);
    lo.route = "/#/" + lo.route;
  }
  if (lo.video && lo.video[0] == "#") {
    lo.video = lo.video.slice(1);
    lo.video = "/#/" + lo.video;
  }
  if (lo.route.endsWith("md") && lo.video) {
    lo.route = lo.video;
  }
}

export function getSortedUnits(los: Lo[]) {
  const allUnits = los.filter((lo) => lo.type == "unit");
  for (const unit of allUnits) {
    const panelVideos = unit.los.filter((lo) => lo.type == "panelvideo");
    const panelTalks = unit.los.filter((lo) => lo.type == "paneltalk");
    const standardLos = unit.los.filter((lo) => lo.type !== "unit" && lo.type !== "panelvideo" && lo.type !== "paneltalk");
    const sortedLos: Lo[] = [];
    sortedLos.push(...panelVideos);
    sortedLos.push(...panelTalks);
    sortedLos.push(...standardLos);
    unit.los = sortedLos;
  }
  return allUnits;
}

export function isValidCourseName(course: string) {
  let isValid = true;
  if (course.length > 27 && course[24] == "-" && course[25] == "-") {
    isValid = false;
  } else {
    if (course.startsWith("main--") || course.startsWith("master--")) {
      isValid = false;
    }
    if (course.startsWith("deploy-preview")) {
      isValid = false;
    }
  }
  return isValid;
}

export async function getCourseSummary(courseId: string): Promise<Lo> {
  const response = await fetch(`https://${courseId}.netlify.app/tutors.json`);
  const lo = await response.json();
  lo.type = "web";
  lo.route = `https://reader.tutors.dev//#/course/${courseId}.netlify.app`;
  lo.img = lo.img.replace("{{COURSEURL}}", `${courseId}.netlify.app`);
  if (lo.properties.icon) {
    lo.icon = lo.properties.icon;
  }
  return lo;
}

export function updateLo(root: string, course: Course, currentLo: Lo) {
  const lo = {
    icon: {},
    img: currentLo.img,
    title: currentLo.title,
    courseTitle: course.lo.title,
    subRoute: currentLo.route,
    isPrivate: 0,
  };
  if (currentLo.type === "course" && currentLo.icon) {
    lo.icon = currentLo.icon;
  } else {
    if (currentLo?.frontMatter?.icon) {
      lo.icon = {
        type: currentLo.frontMatter.icon["type"],
      };
      if (currentLo.frontMatter.icon["color"]) {
        lo.icon.color = currentLo.frontMatter.icon["color"];
      }
    }
  }
  if (course.lo.properties?.private) {
    lo.isPrivate = course.lo.properties?.private as unknown as number;
  }
  writeObj(`${root}/lo`, lo);
}
