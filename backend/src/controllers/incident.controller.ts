import { Request, Response, NextFunction } from 'express';
import { incidentService } from '../services/incident.service.js';
import { ForensicAnchorPayload } from '../types/incident.types.js';

export class IncidentController {
  private getParamId(req: Request): string {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  }

  public async anchorIncident(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const payload = req.body as ForensicAnchorPayload;
      const result = await incidentService.anchorForensicIncident(payload);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public async getIncident(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = this.getParamId(req);
      const incident = await incidentService.getIncident(id);
      res.status(200).json({
        success: true,
        data: incident
      });
    } catch (error) {
      next(error);
    }
  }

  public async listIncidents(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const incidents = await incidentService.listIncidents();
      res.status(200).json({
        success: true,
        count: incidents.length,
        data: incidents
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyIncident(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = this.getParamId(req);
      const verification = await incidentService.verifyIncident(id);
      res.status(200).json({
        success: true,
        data: verification
      });
    } catch (error) {
      next(error);
    }
  }

  public async enforceFine(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = this.getParamId(req);
      const result = await incidentService.enforceFine(id);
      res.status(200).json({
        success: true,
        message: 'Fine enforced and port-clearance revocation event confirmed on-chain',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public async settleFine(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = this.getParamId(req);
      const result = await incidentService.settleFine(id);
      res.status(200).json({
        success: true,
        message: 'Fine settlement confirmed on-chain',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public async releasePortClearance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = this.getParamId(req);
      const result = await incidentService.releasePortClearance(id);
      res.status(200).json({
        success: true,
        message: 'Port clearance released and confirmed on-chain',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const incidentController = new IncidentController();
