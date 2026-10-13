import mongoose, { Schema, type Document } from "mongoose"
import { registerModel } from "@/lib/register-model"

export const AAPANEL_SERVER_STATUSES = ["active", "disabled"] as const
export type AaPanelServerStatus = (typeof AAPANEL_SERVER_STATUSES)[number]

export interface IAaPanelServer extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  panelUrl: string
  apiKeyEnc: string
  rootPath: string
  dbHost: string
  serverIp: string
  priority: number
  maxSites: number
  status: AaPanelServerStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

const aaPanelServerSchema = new Schema<IAaPanelServer>(
  {
    name: { type: String, required: true, trim: true, maxlength: 191 },
    panelUrl: { type: String, required: true, trim: true, maxlength: 255 },
    apiKeyEnc: { type: String, required: true },
    rootPath: { type: String, required: true, trim: true, maxlength: 255, default: "/www/wwwroot" },
    dbHost: { type: String, required: true, trim: true, maxlength: 191, default: "127.0.0.1" },
    serverIp: { type: String, required: true, trim: true, maxlength: 64 },
    priority: { type: Number, default: 100, min: 0 },
    maxSites: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: AAPANEL_SERVER_STATUSES, default: "active", index: true },
    notes: { type: String, default: null, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false }
)

aaPanelServerSchema.index({ status: 1, priority: 1 })
aaPanelServerSchema.index({ name: 1 })

export const AaPanelServer = registerModel<IAaPanelServer>("AaPanelServer", aaPanelServerSchema)

export interface ICloudflareAccount extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  accountId: string | null
  authEmail: string | null
  authMode: "apiToken" | "globalKey"
  apiTokenEnc: string
  defaultNs1: string | null
  defaultNs2: string | null
  status: AaPanelServerStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

const cloudflareAccountSchema = new Schema<ICloudflareAccount>(
  {
    name: { type: String, required: true, trim: true, maxlength: 191 },
    accountId: { type: String, default: null, trim: true, maxlength: 191 },
    authEmail: { type: String, default: null, trim: true, maxlength: 191 },
    authMode: { type: String, enum: ["apiToken", "globalKey"], default: "globalKey" },
    apiTokenEnc: { type: String, required: true },
    // NS cố định user trỏ về (Vanity NS / NS account Cloudflare). Worker dùng
    // để set NS cho domain mua qua Spaceship; form thuê hiện 2 NS này.
    defaultNs1: { type: String, default: null, trim: true, maxlength: 191 },
    defaultNs2: { type: String, default: null, trim: true, maxlength: 191 },
    status: { type: String, enum: AAPANEL_SERVER_STATUSES, default: "active", index: true },
    notes: { type: String, default: null, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false }
)

cloudflareAccountSchema.index({ status: 1, name: 1 })

export const CloudflareAccount = registerModel<ICloudflareAccount>(
  "CloudflareAccount",
  cloudflareAccountSchema
)

export interface IDeployCode extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  codeUrl: string
  configFilePath: string
  configTemplate: string
  sqlFilePath: string
  phpVersions: string[]
  defaultPhpVersion: string
  status: number
  createdAt: Date
  updatedAt: Date
}

const deployCodeSchema = new Schema<IDeployCode>(
  {
    name: { type: String, required: true, trim: true, maxlength: 191 },
    codeUrl: { type: String, required: true, trim: true, maxlength: 2000 },
    configFilePath: { type: String, default: ".env", trim: true, maxlength: 255 },
    configTemplate: { type: String, default: "", maxlength: 100_000 },
    sqlFilePath: { type: String, default: "", trim: true, maxlength: 255 },
    phpVersions: { type: [String], default: ["81"] },
    defaultPhpVersion: { type: String, default: "81", trim: true, maxlength: 8 },
    status: { type: Number, default: 1, index: true },
  },
  { timestamps: true, versionKey: false }
)

deployCodeSchema.index({ status: 1, name: 1 })

export const DeployCode = registerModel<IDeployCode>("DeployCode", deployCodeSchema)
