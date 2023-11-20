import { NextFunction, Request, Response } from 'express';
import hijackResponse from 'hijackresponse';
import stringReplaceStream from './stringReplaceStream';

export type Options = Record<'contentTypeFilterRegexp', RegExp>;

export type ReplaceFunction = (req: Request, res: Response) => string;

const defaultOptions: Options = {
  contentTypeFilterRegexp: /^text\/|^application\/json$|^application\/xml$/,
};

export const stringReplace = (
  replacements: Record<string, string | ReplaceFunction>,
  options: Partial<Options> = {}
) => {
  const opts = { ...defaultOptions, ...options };

  // Split string and function replacements so we don't have to process them on every request
  let stringReplacements: Record<string, string> = {};
  let functionReplacements: Record<string, ReplaceFunction> = {};
  Object.keys(replacements).forEach(function(key, _index) {
    const replacement = replacements[key];
    if (typeof replacement === 'function') {
      functionReplacements[key] = replacement;
    } else {
      stringReplacements[key] = replacement;
    }
  });

  return (req: Request, res: Response, next: NextFunction) => {
    hijackResponse(res, function(err, res) {
      const contentType = res.get('content-type') || '';
      if (opts.contentTypeFilterRegexp.test(contentType)) {
        if (err) {
          res.unhijack(); // Make the original res object work again
          return next(err);
        }
        res.removeHeader('content-length');

        // Make a set of replacements scoped for this request
        let scopedReplacements = { ...stringReplacements };
        Object.keys(functionReplacements).forEach(function(key, _index) {
          scopedReplacements[key] = functionReplacements[key](req, res);
        });

        res.pipe(stringReplaceStream(scopedReplacements)).pipe(res);
      } else {
        return res.unhijack();
      }
    });
    next();
  };
};

module.exports = stringReplace;
module.exports.stringReplace = stringReplace;
