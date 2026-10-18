import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/environment";
import { supabase } from "../config/supabase";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        role: string;
      };
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      if (
        decoded.type ||
        typeof decoded.id !== "string" ||
        !["student", "teacher", "admin"].includes(decoded.role)
      ) {
        return res
          .status(401)
          .json({ message: "Not authorized, session token required" });
      }
      // Read on every request: roles and suspension must affect existing JWTs.
      const { data: account, error } = await supabase
        .from("users")
        .select("id,role,status,session_version")
        .eq("id", decoded.id)
        .maybeSingle();
      if (error)
        return res
          .status(503)
          .json({ message: "Account verification is temporarily unavailable" });
      if (
        !account ||
        account.status !== "active" ||
        !["student", "teacher", "admin"].includes(account.role) ||
        (decoded.version ?? 0) !== account.session_version
      ) {
        return res
          .status(401)
          .json({
            message:
              "Session expired or account access changed. Please sign in again.",
          });
      }
      req.user = { _id: account.id, role: account.role };
      return next();
    } catch {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user?.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
