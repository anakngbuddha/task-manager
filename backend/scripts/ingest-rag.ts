import dotenv from 'dotenv'
import { ingestCanonicalDocs } from '../src/services/rag.service.js'

dotenv.config()

ingestCanonicalDocs().catch(console.error)
